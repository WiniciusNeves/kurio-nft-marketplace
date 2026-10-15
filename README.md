# Kurio — Marketplace de NFTs

**Demo publicada:** https://kurio-nft-marketplace-dusky.vercel.app

> A demo roda com os mocks ligados (MSW no navegador), incluindo REST e Socket.IO. Para testar os cenários de falha, use o botão **Mocks** (canto inferior esquerdo no desktop, ou o link "Painel de simulação (mocks)" no rodapé do mobile) ou adicione `?mock-scenario=<id>` à URL. Para restaurar os dados, use `?mock-reset=1`.

Implementação do desafio frontend **Kurio** em React + TypeScript. Inclui catálogo, detalhe, carrinho, pagamento, recibo, login/cadastro, perfil e carteiras, nas versões desktop e mobile.

API, autenticação, carteiras, pagamentos e eventos em tempo real são **simulados com MSW**: REST e Socket.IO via `@mswjs/socket.io-binding`. A simulação roda no navegador, inclusive no build publicado.

> Arquitetura, contratos, política de cache, reconciliação REST × Socket.IO, limitações e desvios do Figma estão em **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

## Stack

| Responsabilidade       | Tecnologia                                                        |
| ---------------------- | ----------------------------------------------------------------- |
| Interface / linguagem  | React 19 + TypeScript 5.8 (Vite 6)                                |
| Roteamento             | TanStack Router: rotas, search params tipados e proteção de rotas |
| Estado remoto          | TanStack Query: queries, mutations, cache e atualização otimista  |
| HTTP / REST            | Axios, com respostas validadas por Zod                            |
| Tempo real             | `socket.io-client`                                                |
| Estilo / componentes   | Tailwind CSS 4 + shadcn/ui (Radix), adaptados ao Figma            |
| Mocking                | MSW 2 (REST) + `@mswjs/socket.io-binding` (Socket.IO)             |
| E2E / regressão visual | Playwright (Chromium, desktop e mobile)                           |
| Auditoria              | Lighthouse 12 (`scripts/lighthouse.mjs`)                          |

## Requisitos

- Node.js **20.19+** (testado com Node 22)
- npm 10+

## Setup

```bash
npm ci
npx playwright install chromium   # apenas para rodar os testes E2E / Lighthouse
npm run dev                       # http://localhost:5173 (mocks ligados por padrão)
```

## Variáveis de ambiente

Nenhuma variável é obrigatória: os padrões abaixo já ativam os mocks. Para mudar algum valor, copie `.env.example` para `.env`.

| Variável               | Padrão                      | Uso                                                                        |
| ---------------------- | --------------------------- | -------------------------------------------------------------------------- |
| `VITE_ENABLE_MOCKS`    | `true`                      | Ativa a camada MSW (REST + Socket.IO). Só use `false` com um backend real. |
| `VITE_API_URL`         | `/api`                      | Base das chamadas REST (Axios).                                            |
| `VITE_SOCKET_URL`      | `wss://realtime.kurio.mock` | Servidor Socket.IO, interceptado pelo MSW.                                 |
| `VITE_MOCK_SCENARIO`   | `default`                   | Cenário inicial dos mocks.                                                 |
| `VITE_SHOW_MOCK_PANEL` | `true`                      | Mostra o botão **Mocks**, que abre o painel de cenários e eventos.         |
| `VITE_HTTP_TIMEOUT_MS` | `10000`                     | Timeout das requisições REST (Axios).                                      |

## Credenciais fictícias

| Usuário       | E-mail            | Senha       |
| ------------- | ----------------- | ----------- |
| Ana Ribeiro   | `ana@kurio.dev`   | `Kurio2026` |
| Bruno Tavares | `bruno@kurio.dev` | `Kurio2026` |

As senhas são guardadas com hash PBKDF2-SHA256 no banco simulado e nunca em claro. Cupons disponíveis: `KURIO10` (10%), `LANCAMENTO5` (5%) e `VERAO2025` (expirado). Qualquer outro código é tratado como inválido.

## Comandos

| Comando                   | O que faz                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `npm run dev`             | Desenvolvimento com mocks                                                           |
| `npm run build`           | Build de produção (`tsc -b` + `vite build`)                                         |
| `npm run build:demo`      | Build de demonstração com mocks (é o que vai para a Vercel)                         |
| `npm run preview`         | Serve o build em `http://localhost:4173`                                            |
| `npm run typecheck`       | Verificação de tipos                                                                |
| `npm run lint`            | ESLint                                                                              |
| `npm run format`          | Formata o código com Prettier (+ ordenação de classes Tailwind)                     |
| `npm run format:check`    | Verifica a formatação (útil no CI)                                                  |
| `npm run test:e2e`        | Playwright: builda a demo, sobe o preview e roda desktop + mobile                   |
| `npm run test:e2e:update` | Regenera as baselines de regressão visual                                           |
| `npm run test:report`     | Abre o relatório HTML (`playwright-report/`)                                        |
| `npm run lighthouse`      | Auditoria Lighthouse: 3 execuções × página × perfil, saída em `reports/lighthouse/` |

## Cenários da simulação

Você escolhe o cenário por um destes caminhos, em ordem de prioridade:

1. Query string: `?mock-scenario=<id>`. Também aceita `&mock-latency=none|auto` e `&mock-order-ms=<ms>`.
2. Painel **Mocks**: botão flutuante no canto inferior esquerdo (desktop/tablet) ou link "Painel de simulação (mocks)" no rodapé (mobile).
3. Variável `VITE_MOCK_SCENARIO`.

**Reset:** `?mock-reset=1` ou o botão "Resetar cenário" no painel restauram integralmente o banco simulado. O estado também é persistido em `localStorage`, então sobrevive a refresh.

| Cenário                 | Efeito                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `default`               | Sucesso, com latência leve e determinística                                                         |
| `empty`                 | Catálogo vazio                                                                                      |
| `slow`                  | 2,5 s por requisição (mostra os skeletons)                                                          |
| `variable-latency`      | Latência determinística entre 200 ms e 2 s                                                          |
| `out-of-order`          | Respostas do catálogo chegam fora de ordem                                                          |
| `offline`               | Falha de rede em toda a API e no socket                                                             |
| `timeout`               | A 1ª requisição do catálogo/detalhe não responde; o Axios aborta em 10 s e a nova tentativa carrega |
| `server-error`          | HTTP 500 no catálogo e no detalhe                                                                   |
| `flaky`                 | 503 na 1ª tentativa de cada rota, sucesso depois (retry)                                            |
| `unauthorized`          | 403 em todas as rotas privadas                                                                      |
| `short-session`         | A sessão expira 20 s após o login                                                                   |
| `favorites-fail`        | Mutations de favoritos falham (rollback otimista)                                                   |
| `checkout-price-change` | O preço muda no instante da confirmação (409 `QUOTE_CHANGED`)                                       |
| `checkout-sold-out`     | A edição esgota no instante da confirmação (409 `AVAILABILITY_CONFLICT`)                            |
| `order-timeout`         | O pedido é criado, mas a resposta se perde; o retry com a mesma chave recupera o mesmo pedido       |
| `payment-declined`      | O pagamento é recusado (pedido termina em `declined`)                                               |
| `wallet-rejected`       | O usuário recusa a conexão da carteira                                                              |

## Favoritos

Favorite pelo coração do card (catálogo), do detalhe ou da própria lista. Os favoritos ficam em **Minha conta › Lista de interesse** (`/account/favorites`), que também é aberta pelo coração da barra inferior no mobile. Para ver o rollback otimista, use o cenário `favorites-fail`.

## Como reproduzir os fluxos de falha

Para todos os fluxos abaixo, entre como `ana@kurio.dev`.

- **Preço muda durante o checkout (Socket.IO):**
  1. Adicione um NFT ao carrinho e vá para Pagamento.
  2. Conecte a carteira e clique em "Confirmar compra" para abrir a revisão.
  3. No painel Mocks, clique em "Alterar preço do 1º item do carrinho".

  A revisão fica marcada como desatualizada e a confirmação é bloqueada até você atualizar a cotação.

- **Item esgota com o carrinho aberto:** no painel Mocks, use "Esgotar edição do 1º item".
- **Eventos duplicados ou antigos:** "Reemitir último evento" e "Emitir evento antigo". Os eventos são ignorados, e o preço não regride para `99.99`.
- **Queda de conexão com pedido pendente:**
  1. Abra a demo com `?mock-order-ms=8000`.
  2. Confirme uma compra.
  3. Na tela "Aguardando confirmação", clique em "Derrubar conexão Socket.IO" e/ou recarregue a página.

  O mesmo pedido é recuperado e finalizado, sem criar outra compra.

- **Timeout na criação do pedido:** use `?mock-scenario=order-timeout` e confirme a compra. O cliente reenvia com a mesma `Idempotency-Key`.
- **Timeout de rede:** abra `/nft/emerald-ape-042?mock-scenario=timeout`. O skeleton fica na tela, o Axios aborta em 10 s e a nova tentativa carrega o NFT.
- **Sessão expirada:** clique em "Expirar sessão" e depois em qualquer ação autenticada, ou recarregue a página. Você vai para o login com o destino preservado, e o rascunho do checkout é mantido.

## Testes E2E

```bash
npm run test:e2e                              # desktop (todos) + mobile (@main)
npx playwright test --project=desktop-chromium
npx playwright test -g "idempotência"
npm run test:report
```

Como os testes são organizados:

- **Isolamento:** cada teste roda num contexto novo, então o `localStorage` começa vazio e o banco simulado é recriado do zero.
- **Controle de tempo e eventos:**
  - latência zerada por `mock-latency=none`, exceto nos testes de lentidão;
  - relógio controlado com `page.clock` no teste de expiração;
  - eventos disparados pelos endpoints `/api/__mock/*`, que passam pelo MSW e chegam ao app pelo `socket.io-client`.
- **Artefatos:**
  - traces, vídeos e screenshots das falhas ficam em `test-results/`;
  - o relatório HTML fica em `playwright-report/`;
  - as baselines visuais ficam em `tests/e2e/__screenshots__/`.

> As baselines foram geradas em Linux (Chromium headless). Em outro SO, a renderização de fontes muda alguns pixels. Rode `npm run test:e2e:update` uma vez localmente ou use o mesmo ambiente de CI.

## Lighthouse

```bash
npm run build:demo && npm run lighthouse
```

O script gera, em `reports/lighthouse/`:

- os relatórios HTML/JSON de cada execução;
- `summary.md` e `summary.json`, com as medianas por categoria, LCP/CLS/TBT, versões das ferramentas e condições de execução.

A análise dos resultados está no [ARCHITECTURE.md › Performance](./ARCHITECTURE.md#performance-e-lighthouse).

## Deploy (Vercel)

O `vercel.json` já vem configurado:

- build: `npm run build:demo`;
- saída: `dist`;
- rewrite de SPA para acesso direto e refresh em qualquer rota;
- exceção no rewrite para `mockServiceWorker.js`.

Para publicar:

1. Suba o repositório no GitHub.
2. Na Vercel, clique em **Add New → Project**, selecione o repositório e mantenha o preset **Vite**. O `vercel.json` sobrescreve o build.
3. Faça o deploy. Não é preciso configurar variáveis de ambiente.

URL de produção: https://kurio-nft-marketplace-dusky.vercel.app. Cada push na `main` gera um deploy novo automaticamente.

Netlify e Cloudflare Pages também funcionam: use `npm run build:demo`, publique `dist/` e configure o fallback de SPA para `/index.html`.
