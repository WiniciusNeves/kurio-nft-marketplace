import type { Page } from '@playwright/test'
import {
  addToCartFromDetail,
  expect,
  gotoApp,
  login,
  mockControl,
  setScenario,
  test,
  waitRealtime,
  type Scenario,
} from './fixtures'

async function prepareCheckout(page: Page, opts: { scenario?: Scenario; orderMs?: number } = {}) {
  await gotoApp(page, '/login?redirect=%2F', opts)
  await login(page)
  await expect(page).toHaveURL(/\/$|\/\?/)
  await addToCartFromDetail(page, 'emerald-ape-042', 2)
  await page.goto('/checkout')
  await expect(page.getByTestId('checkout-items')).toContainText('Emerald Ape #042')
  await waitRealtime(page)
}

async function fillAndConnect(page: Page) {
  await page.getByLabel('Código de indicação').fill('KURIOANA')
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByTestId('wallet-connection')).toContainText('Conectada')
}

async function openReview(page: Page) {
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByTestId('review-dialog')).toBeVisible()
}

test.describe('Compra', () => {
  test('@main compra completa do catálogo ao recibo confirmado', async ({ page }) => {
    await gotoApp(page, '/login?redirect=%2Fmercado')
    await login(page)
    await page
      .getByTestId('nft-card')
      .filter({ hasText: 'Emerald Ape #042' })
      .getByRole('link', { name: 'Emerald Ape #042', exact: true })
      .click()
    await expect(page.getByTestId('nft-title')).toHaveText('Emerald Ape #042')
    await addToCartFromDetail(page, 'emerald-ape-042', 2)
    await page.goto('/cart')
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/checkout/)
    await waitRealtime(page)

    // Validação de campos antes da revisão
    await page.locator('#email').fill('invalido')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByText('E-mail inválido')).toBeVisible()
    await page.locator('#email').fill('ana@kurio.dev')

    await fillAndConnect(page)
    await openReview(page)
    await expect(page.getByTestId('review-dialog')).toContainText('2.38 ETH')
    await page.getByTestId('confirm-order').click()

    await expect(page).toHaveURL(/\/orders\/ord_/)
    await expect(page.getByTestId('order-pending').or(page.getByTestId('order-confirmed'))).toBeVisible()
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('receipt-total')).toHaveText('2.396 ETH')
    await expect(page.getByTestId('receipt-line')).toHaveCount(1)
    await expect(page.getByTestId('tx-id')).toHaveText(/^0x/)

    // Recibo é snapshot: mudança posterior no catálogo não altera valores
    await mockControl(page, '/nfts/emerald-ape-042', { editionId: '1-50', price: '9.99' })
    await page.reload()
    await expect(page.getByTestId('receipt-total')).toHaveText('2.396 ETH')

    // Itens comprados saem do carrinho
    await page.goto('/cart')
    await expect(page.getByTestId('cart-empty')).toBeVisible()
  })

  test('pagamento recusado preserva os itens no carrinho', async ({ page }) => {
    await prepareCheckout(page, { scenario: 'payment-declined' })
    await fillAndConnect(page)
    await openReview(page)
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-declined')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page.getByTestId('cart-item')).toHaveCount(1)
  })

  test('recusa de conexão da carteira é informada', async ({ page }) => {
    await prepareCheckout(page, { scenario: 'wallet-rejected' })
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await expect(page.getByText(/conexão foi recusada/)).toBeVisible()
    await expect(page.getByTestId('wallet-connection')).toContainText('não conectada')
  })

  test('clique repetido não cria pedidos duplicados', async ({ page }) => {
    await prepareCheckout(page, { orderMs: 1500 })
    await fillAndConnect(page)
    await openReview(page)
    // Três cliques no mesmo tick (antes de o React re-renderizar e desabilitar o botão)
    await page.getByTestId('confirm-order').evaluate((btn: HTMLButtonElement) => {
      btn.click()
      btn.click()
      btn.click()
    })
    await expect(page).toHaveURL(/\/orders\/ord_/)
    const orders = await page.evaluate(async () => {
      const token = JSON.parse(localStorage.getItem('kurio:session')!).token
      const r = await fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } })
      return (await r.json()).items as unknown[]
    })
    expect(orders).toHaveLength(1)
  })

  test('timeout após criação do pedido recupera o MESMO pedido por idempotência', async ({ page }) => {
    await prepareCheckout(page, { scenario: 'order-timeout' })
    await fillAndConnect(page)
    await openReview(page)
    await page.getByTestId('confirm-order').click()
    await expect(page).toHaveURL(/\/orders\/ord_/, { timeout: 15_000 })
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 10_000 })
    const orders = await page.evaluate(async () => {
      const token = JSON.parse(localStorage.getItem('kurio:session')!).token
      const r = await fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } })
      return (await r.json()).items as unknown[]
    })
    expect(orders).toHaveLength(1)
  })

  test('mesma chave com conteúdo diferente gera conflito (contrato)', async ({ page }) => {
    await prepareCheckout(page)
    const result = await page.evaluate(async () => {
      const token = JSON.parse(localStorage.getItem('kurio:session')!).token
      const h = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'chave-fixa-de-teste-123',
      }
      const q = await (
        await fetch('/api/quote', { method: 'POST', headers: h, body: JSON.stringify({ network: 'ethereum' }) })
      ).json()
      const ws = await (
        await fetch('/api/me/wallets/wal_ana_primary/connect', {
          method: 'POST',
          headers: h,
          body: JSON.stringify({ network: 'ethereum' }),
        })
      ).json()
      const buyer = {
        displayName: 'Ana',
        username: 'ana.coleciona',
        profileName: 'ana',
        email: 'ana@kurio.dev',
        ensName: 'ana.eth',
        referralCode: 'KURIOANA',
      }
      const body = {
        quoteId: q.id,
        quoteFingerprint: q.fingerprint,
        walletId: 'wal_ana_primary',
        walletSessionId: ws.id,
        network: 'ethereum',
        buyer,
      }
      const a = await fetch('/api/orders', { method: 'POST', headers: h, body: JSON.stringify(body) })
      const b = await fetch('/api/orders', { method: 'POST', headers: h, body: JSON.stringify(body) })
      const c = await fetch('/api/orders', {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ ...body, buyer: { ...buyer, displayName: 'Outro' } }),
      })
      return {
        a: a.status,
        b: b.status,
        idA: (await a.json()).id,
        idB: (await b.json()).id,
        c: c.status,
        code: (await c.json()).error.code,
      }
    })
    expect(result.a).toBe(201)
    expect(result.b).toBe(200)
    expect(result.idA).toBe(result.idB)
    expect(result.c).toBe(409)
    expect(result.code).toBe('IDEMPOTENCY_CONFLICT')
  })
})

test.describe('Tempo real no checkout', () => {
  test('@main preço muda via Socket.IO durante o checkout e exige nova confirmação', async ({ page }) => {
    await prepareCheckout(page)
    await fillAndConnect(page)
    await openReview(page)
    // Evento emitido pelo "servidor" MSW e recebido pelo socket.io-client
    await mockControl(page, '/nfts/emerald-ape-042', { editionId: '1-50', deltaPrice: '0.1' })
    await expect(page.getByTestId('quote-stale')).toBeVisible()
    await expect(page.getByTestId('confirm-order')).toBeDisabled()
    await expect(page.getByText(/O preço de Emerald Ape #042 mudou/)).toBeVisible()
    await page.getByRole('button', { name: 'Atualizar cotação' }).click()
    await expect(page.getByTestId('quote-changed')).toContainText('2.596 ETH')
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('receipt-total')).toHaveText('2.596 ETH')
  })

  test('preço muda no servidor no momento da confirmação (QUOTE_CHANGED)', async ({ page }) => {
    await prepareCheckout(page, { scenario: 'checkout-price-change' })
    await fillAndConnect(page)
    await openReview(page)
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('submit-error')).toContainText('valores do pedido mudaram')
    await expect(page.getByTestId('quote-changed')).toBeVisible()
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 10_000 })
  })

  test('edição esgota durante a compra', async ({ page }) => {
    await prepareCheckout(page, { scenario: 'checkout-sold-out' })
    await fillAndConnect(page)
    await openReview(page)
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('submit-error')).toContainText('disponibilidade')
    await page.goto('/cart')
    await expect(page.getByTestId('item-issues')).toContainText('Edição esgotada')
  })

  test('carrinho aberto reflete preço alterado e eventos duplicados/antigos são ignorados', async ({ page }) => {
    await prepareCheckout(page)
    await page.goto('/cart')
    await waitRealtime(page)
    await expect(page.getByTestId('line-total')).toHaveText('2.38 ETH')
    await mockControl(page, '/nfts/emerald-ape-042', { editionId: '1-50', deltaPrice: '0.5' })
    await expect(page.getByTestId('cart-issues')).toBeVisible()
    await expect(page.getByTestId('line-total')).toHaveText('3.38 ETH')
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeDisabled()

    // Duplicata e evento antigo (preço 99.99, versão menor) não regridem nem reaplicam
    await page.goto('/nft/emerald-ape-042')
    await waitRealtime(page)
    await expect(page.getByTestId('nft-price')).toHaveText('1.69 ETH')
    await mockControl(page, '/realtime/duplicate')
    await mockControl(page, '/realtime/stale')
    await page.waitForTimeout(500)
    await expect(page.getByTestId('nft-price')).toHaveText('1.69 ETH')
    await expect(page.getByText('99.99')).toHaveCount(0)

    await page.goto('/cart')
    await page.getByRole('button', { name: 'Aceitar valores atuais' }).click()
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeEnabled()
  })

  test('desconexão com pedido pendente: retomada após reconectar e após refresh, sem nova compra', async ({ page }) => {
    await prepareCheckout(page, { orderMs: 4000 })
    await fillAndConnect(page)
    await openReview(page)
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    // Derruba a conexão enquanto o pedido está pendente
    await mockControl(page, '/realtime/disconnect')
    await page.reload() // recarregar no meio do processamento
    await expect(page.getByTestId('order-pending').or(page.getByTestId('order-confirmed'))).toBeVisible()
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 12_000 })
    await waitRealtime(page)
    // Voltar ao checkout não cria outra compra
    await page.goto('/checkout')
    await expect(page.locator('#conteudo')).toBeVisible()
    const count = await page.evaluate(async () => {
      const token = JSON.parse(localStorage.getItem('kurio:session')!).token
      const r = await fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } })
      return ((await r.json()).items as unknown[]).length
    })
    expect(count).toBe(1)
  })

  test('expiração de sessão no checkout preserva o rascunho', async ({ page }) => {
    await prepareCheckout(page)
    await page.getByLabel('Observação do colecionador (opcional)').fill('Entregar na carteira fria')
    await mockControl(page, '/session/expire')
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await expect(page).toHaveURL(/reason=expired/)
    await login(page)
    await expect(page).toHaveURL(/\/checkout/)
    await expect(page.getByLabel('Observação do colecionador (opcional)')).toHaveValue('Entregar na carteira fria')
    await setScenario(page, 'default')
  })
})
