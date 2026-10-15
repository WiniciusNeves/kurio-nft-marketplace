# Arquitetura — Kurio

## Visão geral

```
src/
  api/            contracts.ts (Zod: REST + eventos), http.ts (Axios), endpoints.ts,
                  errors.ts (ApiError), queryKeys.ts, queryClient.ts, guestCart.ts
  app/            App, router (TanStack Router), RootLayout (sessão, socket, layout), Protected
  realtime/       realtime.ts (socket.io-client + reconciliação com o cache), RealtimeIndicator
  features/       auth/ cart/ catalog/ checkout/ favorites/ devtools/ (hooks + componentes de domínio)
  pages/          telas (Home/Mercado, Detalhe, Carrinho, Checkout, Pedido/Recibo, Auth, Conta)
  components/     ui/ (shadcn/ui adaptado), layout/ (Header, Footer, MobileTabBar), utilitários
  mocks/          MSW: config (cenários), db (estado + persistência), fixtures, http (rede/erros/auth),
                  realtime (Socket.IO), orders (liquidação), handlers/ (catalog, account, commerce, control)
  lib/            eth.ts (decimal.js), forms.ts, utils.ts
tests/e2e/        Playwright (fixtures + specs + baselines visuais)
scripts/          lighthouse.mjs
```

Princípios:

- **Contratos únicos.** `src/api/contracts.ts` define com Zod todos os payloads REST e os eventos. O cliente valida as respostas em runtime e os handlers MSW constroem as respostas com os mesmos tipos.
- **Mocks só na rede.** Componentes, hooks e Axios não contêm dados fictícios nem caminhos alternativos. Com `VITE_ENABLE_MOCKS=false`, o app chamaria um backend real em `VITE_API_URL` e `VITE_SOCKET_URL`.
- **Servidor como fonte da verdade** para preço, disponibilidade, cupom, taxas e totais. O cliente apenas exibe o que vem da cotação, sem refazer as contas.

## Contratos REST

Base `/api`. Os erros seguem sempre o formato `{ error: { code, message, fieldErrors?, details? } }`.

| Recurso         | Método e rota                                                                                                                    | Notas                                                                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sessão          | `POST /auth/register`                                                                                                            | 201 `Session`; 409 `EMAIL_TAKEN` / `USERNAME_TAKEN` com `fieldErrors`; 422 validação                                                                                  |
|                 | `POST /auth/login`                                                                                                               | 200 `Session`; 401 `INVALID_CREDENTIALS`                                                                                                                              |
|                 | `GET /auth/session`                                                                                                              | 200 `Session`; 401 `SESSION_EXPIRED` / `UNAUTHENTICATED`                                                                                                              |
|                 | `POST /auth/logout`                                                                                                              | 204; revoga o token e desassocia o socket                                                                                                                             |
| NFTs            | `GET /nfts?q&category[]&network[]&minPrice&maxPrice&sort&tab&page&pageSize`                                                      | `CatalogResponse` com `facets` e `priceRange`; 422 para faixa inválida                                                                                                |
|                 | `GET /nfts/:id` / `GET /nfts/:id/related`                                                                                        | 404 `NOT_FOUND`                                                                                                                                                       |
| Favoritos       | `GET /me/favorites` · `GET /me/favorites/items` · `PUT/DELETE /me/favorites/:nftId`                                              | `{ nftIds }`                                                                                                                                                          |
| Carrinho        | `GET /cart` · `POST /cart/items` · `PATCH/DELETE /cart/items/:id`                                                                | Visitante usa o header `X-Cart-Id`; autenticado usa o token. 409 `AVAILABILITY_CONFLICT`, 422 limite por pedido                                                       |
|                 | `POST /cart/acknowledge`                                                                                                         | O usuário aceita os preços e a disponibilidade atuais                                                                                                                 |
|                 | `PUT/DELETE /cart/coupon`                                                                                                        | 422 `COUPON_INVALID` / `COUPON_EXPIRED`                                                                                                                               |
|                 | `POST /cart/merge { guestCartId }`                                                                                               | Preserva os itens do visitante ao autenticar                                                                                                                          |
| Cotação         | `POST /quote { network }`                                                                                                        | `Quote` (snapshot com `fingerprint`, linhas, desconto, taxa, total e `expiresAt`)                                                                                     |
| Pedidos         | `POST /orders` + header `Idempotency-Key`                                                                                        | 201 novo; 200 replay (`Idempotent-Replayed: true`); 409 `IDEMPOTENCY_CONFLICT` / `QUOTE_CHANGED` / `AVAILABILITY_CONFLICT` / `QUOTE_EXPIRED` / `WALLET_NOT_CONNECTED` |
|                 | `GET /orders/:id` · `GET /orders?status=`                                                                                        | 404 também para pedido de outro usuário (não revela que ele existe)                                                                                                   |
| Perfil          | `GET/PUT /me/profile` · `POST/DELETE /me/avatar` · `PUT /me/password`                                                            | Avatar via multipart (PNG/JPG/WEBP/GIF, até 1 MB)                                                                                                                     |
| Carteiras       | `GET/POST /me/wallets` · `PUT /me/wallets/:id`                                                                                   | Validação de endereço EVM (`0x` + 40 hex) e Solana (base58)                                                                                                           |
|                 | `POST /me/wallets/:id/connect { network, provider }` · `DELETE /me/wallet-sessions/:id`                                          | Simula conexão e desconexão; 403 `WALLET_REJECTED`                                                                                                                    |
| Controle (mock) | `/__mock/config`, `/__mock/reset`, `/__mock/session/expire`, `/__mock/nfts/:id`, `/__mock/realtime/{duplicate,stale,disconnect}` | Usados pelo painel e pelos testes. Alteram o banco **e** emitem os eventos                                                                                            |

**Valores em ETH** trafegam como string decimal (`"26.846"`) e são calculados com `decimal.js`, nunca com `Number`. As quantidades são inteiras.

## Eventos Socket.IO

Envelope comum: `{ eventId, type, resourceId, version, occurredAt, payload }`.

| Evento          | Payload                                                                               | Destino                                              |
| --------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `nft.updated`   | `{ nftId, price, compareAtPrice, soldOut, editions[{id, available, price}], reason }` | broadcast                                            |
| `order.updated` | `Order` completo + `userId`                                                           | apenas os sockets autenticados como o dono do pedido |

O cliente aplica estas garantias, em `src/realtime/realtime.ts`:

1. **Duplicatas:** um `eventId` já visto é ignorado (LRU de 500 ids).
2. **Ordem e versão:** aplica só se `version` for maior que o máximo entre a versão conhecida pelo socket e a versão no cache REST. Assim, um evento antigo nunca regride o estado.
3. **Isolamento:**
   - o socket é recriado a cada troca de token, com `removeAllListeners()` e `disconnect()`;
   - `order.updated` com `userId` diferente do usuário atual é descartado (defesa em profundidade, além do filtro do servidor).
4. **Aplicação no cache:** `setQueryData` no detalhe e `setQueriesData` em todas as listas do catálogo. O carrinho é **reconciliado via REST** (`invalidateQueries`), porque disponibilidade e problemas por item são calculados no servidor.
5. **Reconexão:** no `connect` seguinte ao primeiro, invalida NFTs, catálogo, carrinho e pedidos ativos.
6. **Ciclo de vida:** listeners de UI (`onNftUpdated`, `onOrderUpdated`) devolvem a função de remoção e são liberados no cleanup dos efeitos.

**Transporte e limitações no ambiente de mocks** (`@mswjs/socket.io-binding` 0.2):

- Apenas WebSocket: o cliente usa `transports: ['websocket']`, sem long-polling.
- O binding responde ao handshake do Engine.IO, mas não envia heartbeat. O mock envia o `PING` (`2`) a cada 20 s para o cliente não encerrar a conexão por `ping timeout`.
- Sem rooms ou namespaces. O isolamento por usuário é feito no handler, que lê o `auth.token` do pacote `CONNECT` (`40{...}`).
- O MSW remove o prefixo `/socket.io/` ao casar a URL, por isso o link é `ws.link('wss://realtime.kurio.mock')`.
- O `engine.io-client` captura `globalThis.WebSocket` quando o módulo é carregado. Por isso `main.tsx` inicia o MSW **antes** de importar o app.
- Eventos emitidos enquanto o cliente está desconectado se perdem, como num servidor real. A recuperação vem da reconciliação REST na reconexão e do polling do pedido pendente enquanto o socket está offline.

## Estado, cache e sincronização

| Dado     | Chave                                                           | Política                                                                                                          |
| -------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Catálogo | `['catalog', query]`                                            | `staleTime` 30 s, `placeholderData: keepPreviousData` (sem “piscar” ao paginar), `AbortSignal` repassado ao Axios |
| Detalhe  | `['nft', id]`                                                   | `staleTime` 30 s; o tempo real mantém atualizado                                                                  |
| Carrinho | `['cart', 'user:<id>' \| 'guest:<cartId>']`                     | `staleTime` 10 s, refetch no foco, invalidado por `nft.updated` e por pedido confirmado                           |
| Privados | `['user', userId, ...]` (perfil, carteiras, favoritos, pedidos) | Removidos no logout, na troca de usuário e na expiração (`removeQueries(['user'])`)                               |

- **Retries:** queries tentam de novo até 2 vezes, só em falhas transitórias (rede, timeout, 5xx), com backoff exponencial. Erros 4xx nunca são repetidos. Mutations não têm retry automático.
- **Atualização otimista com rollback:** favoritos (lista de ids) e quantidade do carrinho. Ambos usam `onMutate` com snapshot, `onError` com restauração e toast acessível, e `onSuccess` com a resposta do servidor.
- **Respostas obsoletas:** cada combinação de filtros é uma query distinta. Quando os filtros mudam, a query anterior fica sem observadores e é cancelada pelo `AbortSignal`, e uma resposta atrasada não sobrescreve a atual. Isso é coberto pelo cenário `out-of-order`.
- **Estado de URL:** busca, filtros, ordenação, aba e página vivem nos search params do TanStack Router, validados com Zod e com `.catch` para valores inválidos.
  - Qualquer mudança de filtro reinicia a página.
  - Filtros e paginação criam entradas no histórico; a busca digitada substitui a entrada atual (com debounce de 350 ms).

## Sessão

- `POST /auth/login` devolve um token opaco com `expiresAt`. A sessão (token + usuário, **sem senha**) fica em `localStorage` e é sincronizada entre abas.
- Ao recarregar, a sessão restaurada é revalidada com `GET /auth/session`.
- A expiração é detectada de três formas:
  - qualquer 401 `SESSION_EXPIRED` em requisição autenticada, pelo interceptor do Axios (`sessionStore.expire()`);
  - `expiresAt` vencido verificado no `beforeLoad` das rotas privadas;
  - revalidação ao recarregar.
- O que acontece ao expirar:
  - dados privados e carrinho saem do cache e o socket é recriado como anônimo;
  - as telas privadas são desmontadas na hora (`<Protected>`);
  - o usuário vai para `/login?redirect=<rota atual>&reason=expired`.
- O rascunho do checkout e a tentativa de pedido ficam em `sessionStorage`, escopados por usuário. Por isso o fluxo é retomado após o relogin.
- **Logout:** `POST /auth/logout` (revoga o token e o vínculo do socket), limpeza do cache privado, dos rascunhos de checkout e da conexão em tempo real.

## Carrinho

- O carrinho é **server-side**, inclusive para o visitante, identificado pelo `X-Cart-Id` em `localStorage`. Por isso sobrevive a refresh e funciona em várias abas.
- No login, `POST /cart/merge` incorpora os itens do visitante, respeitando disponibilidade e limite por pedido. Depois disso o visitante recebe um id novo.
- Cada item guarda o `acknowledgedUnitPrice`. Quando preço ou disponibilidade mudam, a API marca o item com `issues` (`PRICE_CHANGED`, `SOLD_OUT`, `INSUFFICIENT_AVAILABILITY`).
- Enquanto houver item com problema, a UI mostra o “de → para” e bloqueia "Conectar e finalizar" até o usuário aceitar os valores atuais (`POST /cart/acknowledge`).

## Checkout, idempotência e recuperação

1. O formulário é validado (Zod + react-hook-form) e a carteira cadastrada precisa ser conectada na rede escolhida. A simulação cobre conexão, recusa e desconexão.
2. `POST /quote` gera um snapshot com `fingerprint`, que o usuário confere no diálogo de revisão.
3. Se chegar um `nft.updated` para um item cotado, a cotação fica **desatualizada**. A confirmação é bloqueada até "Atualizar cotação", que mostra a diferença e exige nova confirmação.
4. "Confirmar e pagar" envia `POST /orders` com `Idempotency-Key`:
   - a chave é gerada por tentativa (quote + carteira + comprador) e persistida antes do envio;
   - um guard (`inFlight`) impede cliques repetidos no mesmo tick;
   - timeout, falha de rede ou 5xx levam a até 3 reenvios com a **mesma chave**. O servidor devolve o mesmo pedido (200, replay);
   - mesma chave com outro conteúdo gera 409 `IDEMPOTENCY_CONFLICT`;
   - 409 `QUOTE_CHANGED` / `AVAILABILITY_CONFLICT` encerram a tentativa. A nova cotação vem em `details.quote` e a próxima confirmação usa uma chave nova.
5. O pedido nasce `pending`. A tela `/orders/:id` espera o `order.updated` e, com o socket desconectado, faz polling REST a cada 3 s. `confirmed` e `declined` são terminais.
6. **Após refresh:**
   - se a tentativa já tem `orderId`, o checkout redireciona para o pedido;
   - se a resposta se perdeu antes do refresh, o checkout reenvia com a mesma chave e recupera o pedido, sem criar outra compra.
7. O recibo é renderizado só para pedido `confirmed` e reproduz o **snapshot** do pedido (linhas, preços, taxas e total). Mudanças posteriores no catálogo não o afetam.
8. Na liquidação, o servidor remove do carrinho apenas as quantidades compradas. Em caso de recusa, o carrinho fica intacto.

## Mocking (MSW)

- `mocks/db.ts`: estado único com catálogo (60 NFTs determinísticos, 9 categorias e 3 redes), usuários, sessões, carrinhos, favoritos, carteiras, sessões de carteira, cotações, pedidos e mapa de idempotência.
  - É persistido em `localStorage` (`kurio:mock:db`) e versionado por `SCHEMA_VERSION`.
  - `resetDb()` restaura o seed integralmente.
- `mocks/http.ts`: latência determinística por cenário, falhas (`HttpResponse.error()`, 4xx/5xx) e autenticação (Bearer).
- `mocks/orders.ts`: liquidação assíncrona dos pedidos, que é retomada após refresh.
- `mocks/realtime.ts`: servidor Socket.IO. Toda mutação feita por handler ou por controle emite o evento correspondente, então REST e eventos ficam sempre consistentes.
- A camada é ativada por padrão (`VITE_ENABLE_MOCKS` diferente de `false`), está presente no build de demonstração e é usada igualmente em dev, demo e testes.

## Acessibilidade

- Link "Pular para o conteúdo". A cada navegação, o foco vai para o `<main>`.
- Foco visível global (`:focus-visible`) e alvos de toque ≥ 36 px.
- Diálogos e drawers (Radix) prendem o foco, fecham com `Esc` e devolvem o foco ao gatilho.
- Formulários:
  - `label` associado a cada campo e indicação de obrigatório também para leitores de tela;
  - erros ligados por `aria-describedby`, com `aria-invalid` e ícone (não dependem só de cor);
  - foco no primeiro campo inválido.
- Toasts (Sonner) em região `aria-live` para mutations e eventos em tempo real. Status de pedido, total do resumo e status da conexão também usam `aria-live`.
- Controles com estado expõem `aria-pressed` ou `aria-checked` (filtros, favoritos, edições). Os steppers indicam quando o limite foi atingido.
- Texto alternativo descritivo nas imagens dos NFTs; imagens decorativas têm `alt=""`.
- `prefers-reduced-motion` desliga o shimmer dos skeletons e as transições.
- Reflow: sem overflow horizontal em 320, 390, 640 (equivalente a zoom de 200% em 1280 px), 768 e 1440 px — coberto por testes E2E, inclusive nas telas privadas.

**Ajustes em relação ao layout:**

- O texto auxiliar `subtle` (#B39463) foi mantido só para texto ≥ 12 px sobre `surface`, com contraste aproximado de 5,9:1.
- O hover dos cards do catálogo também aparece com foco de teclado (`group-focus-within`).
- No mobile, os cards mostram só o botão de favorito (como no Figma). Adicionar ao carrinho fica no detalhe.

## Performance e Lighthouse

- **Code splitting por rota:** só a página inicial fica no bundle principal.
- O chunk do app e o do MSW são baixados em paralelo (`modulepreload`, injetado por um plugin no `vite.config.ts`), mas só são **avaliados** depois que o MSW inicia.
- A imagem do hero é pré-carregada (`fetchpriority=high`). Abaixo da dobra as imagens usam `loading="lazy"` com `width/height` explícitos.
- Fontes self-hosted em `public/fonts` (Roboto Mono, subset latin, woff2) com `preload` no HTML. O CSS é carregado por `<link>` no `index.html` (não pelo JS), então os estilos aparecem antes de o MSW e o app iniciarem. Uma cor de fundo inline evita o “flash” branco.
- Um app shell estático do hero em `/` usa as mesmas classes do componente, o que evita layout shift.
- `<main>` tem `min-height: 100dvh`, para o rodapé não “pular” enquanto o chunk de uma rota carrega (CLS do detalhe caiu de 0,257 para 0).

Resultados (mediana de 3 execuções) em `reports/lighthouse/summary.md`.

**Abaixo da meta: Performance mobile, entre 76 e 77.** Accessibility, Best Practices e SEO ficam entre 99 e 100, e o desktop fica entre 98 e 100. A causa é estrutural ao requisito de mocks no build auditado:

- No perfil mobile (Moto G, 4× CPU, Slow 4G simulado), o LCP é a primeira imagem do catálogo (ou do detalhe), que depende de dados. Antes do primeiro dado existir, o navegador precisa baixar e executar o MSW (cerca de 111 kB gz), registrar o Service Worker e só então avaliar o app (cerca de 107 kB gz) e responder via handler.
- Cerca de 88% do LCP é _render delay_. O `bootup-time` mostra o MSW e o app entre as principais fontes.
- O TBT (cerca de 300 ms) vem da avaliação desses dois bundles.
- Com um backend real, o chunk do MSW e o Service Worker deixam de existir. A estimativa é LCP mobile abaixo de 2,5 s.
- Não foram aplicadas simplificações exclusivas para a auditoria: as imagens, as fontes, o socket e todos os mocks são carregados normalmente.

## Formatação e qualidade

- Prettier (`npm run format` / `format:check`) com `prettier-plugin-tailwindcss` para ordenar classes; `eslint-config-prettier` evita conflito com o ESLint.
- `npm run typecheck` e `npm run lint` sem erros.

## Desvios do Figma e decisões de UX

- **Telas não desenhadas** (status do pedido pendente/recusado, 404, seções fora do escopo, estados vazios e de erro) seguem a mesma linguagem visual: superfície `#241612`, borda inferior laranja dos modais e tipografia mono.
- **Seções fora do escopo** (Criadores, Aprenda, Atividade, Ofertas, Downloads, Suporte, Diário) levam a uma página "não faz parte desta entrega", sem simular sucesso. Newsletter, login social e "esqueci a senha" também informam isso via toast.
- **Login e cadastro** no desktop aparecem como o card do modal do Figma, mas em rota própria (`/login`, `/register`), o que permite acesso direto e redirecionamento de volta ao fluxo. No mobile, seguem os frames "Mobile / Login" e "Cadastro".
- **Barra inferior mobile:** reproduz o frame "Tab Bar" (duas abas arredondadas com recorte central, ícones preenchidos e botão circular em gradiente). Ícones redesenhados em SVG no estilo "Iconly Bold" do Figma. O coração leva à **Lista de interesse** (`/account/favorites`, os NFTs favoritados) e o botão central ao Mercado.
- **Telas sem frame mobile/tablet** (Perfil, Carteiras, Recibo, Mercado): adaptadas do desktop. No mobile, o menu da conta vira uma linha de chips roláveis com o "Sair" junto, e os formulários ficam em uma coluna.
- **Pagamento (mobile e desktop):** "Carteira conectada" lista as carteiras cadastradas (com "Trocar carteira") e "Carteira e rede" escolhe o aplicativo de conexão (WalletConnect, MetaMask, Coinbase Wallet), como nos frames. No mobile, total e "Confirmar compra" ficam numa barra fixa inferior.
- **Mobile:** sem cabeçalho no topo de Início, Detalhe, Carrinho e Pagamento (como no Figma). A navegação fica na barra inferior. O botão central da barra (ícone de leitura) abre o Mercado, já que leitura de QR está fora do escopo.
- **Checkout:**
  - os campos "Endereço da carteira" e "Tipo de carteira" vêm da carteira cadastrada selecionada e são somente leitura, para garantir que a compra use carteiras cadastradas;
  - "Usar outra carteira?" orienta a escolher outra carteira ou a cadastrar uma nova;
  - o botão "Confirmar compra" abre a **revisão** antes do envio.
- **Contagens do catálogo:** as do Figma (33, 12, 65…) são ilustrativas. As da implementação vêm das fixtures (60 NFTs) e respondem aos filtros.
- **Ícones de marca** (redes sociais) são SVGs próprios, porque o lucide não inclui logos. As imagens dos NFTs foram exportadas do Figma (`public/nfts/`).
- **Faixa de preço:** o slider só aplica ao clicar em "Aplicar" (como no Figma), para não gerar uma requisição a cada passo.
