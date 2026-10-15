import { expect, gotoApp, isMobile, login, mockControl, test } from './fixtures'
import type { Page } from '@playwright/test'

async function openFilters(page: Page) {
  if (isMobile(page)) {
    await page.getByRole('button', { name: /^Filtros/ }).click()
    return page.getByRole('dialog')
  }
  return page.getByTestId('filters').first()
}
async function closeFilters(page: Page) {
  if (isMobile(page)) await page.getByRole('button', { name: /Ver .* resultados/ }).click()
}

test.describe('Catálogo', () => {
  test('@main busca, filtros combinados, ordenação, paginação e restauração pelo histórico', async ({ page }) => {
    await gotoApp(page, '/mercado')
    const grid = page.getByTestId('catalog-grid')
    await expect(grid.getByTestId('nft-card')).toHaveCount(9)
    await expect(page.getByTestId('catalog-total')).toHaveText('60 NFTs encontrados')

    // Paginação
    await page.getByRole('button', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')

    // Filtro reinicia paginação; filtros combinam (coleção + rede)
    let filters = await openFilters(page)
    await filters.getByRole('button', { name: /Música/ }).click()
    await expect(page).not.toHaveURL(/page=2/)
    await filters.getByRole('button', { name: /Polygon/ }).click()
    await closeFilters(page)
    await expect(page).toHaveURL(/category=.*musica/)
    await expect(page).toHaveURL(/network=.*polygon/)
    const filteredCount = await grid.getByTestId('nft-card').count()
    expect(filteredCount).toBeGreaterThan(0)
    await expect(grid.getByText('Golden Frequency #071')).toBeVisible()

    // Ordenação por maior preço
    if (isMobile(page)) {
      filters = await openFilters(page)
      await filters.getByTestId('sort-select').click()
    } else await page.getByTestId('sort-select').click()
    await page.getByRole('option', { name: 'Maior preço' }).click()
    await closeFilters(page)
    await expect(page).toHaveURL(/sort=.*price-desc/)
    const prices = await grid.locator('[data-testid=nft-card] p').allTextContents()
    const nums = prices.map((p) => Number(p.match(/([\d.]+) ETH/)?.[1]))
    expect([...nums].sort((a, b) => b - a)).toEqual(nums)

    // Refresh preserva o estado
    await page.reload()
    await expect(page).toHaveURL(/sort=.*price-desc/)
    await expect(grid.getByTestId('nft-card')).toHaveCount(filteredCount)

    // Histórico: voltar desfaz a ordenação
    await page.goBack()
    await expect(page).not.toHaveURL(/price-desc/)
    await expect(page).toHaveURL(/polygon/)
  })

  test('@main busca textual e resultado vazio', async ({ page }) => {
    await gotoApp(page, '/mercado')
    if (isMobile(page)) await page.getByTestId('catalog-search').fill('golden')
    else {
      await page.getByRole('button', { name: 'Buscar NFTs' }).click()
      await page.getByLabel('Termo de busca').fill('golden')
      await page.keyboard.press('Enter')
    }
    await expect(page).toHaveURL(/q=golden/)
    await expect(page.getByTestId('catalog-total')).toContainText('para “golden”')
    for (const t of await page.getByTestId('nft-card').locator('h3').allTextContents())
      expect(t.toLowerCase()).toContain('golden')

    await page.goto('/mercado?q=%22inexistente-xyz%22')
    await expect(page.getByTestId('catalog-empty')).toBeVisible()
    await page.getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(page.getByTestId('nft-card')).toHaveCount(9)
  })

  test('ações do card (carrinho e favorito) funcionam sem abrir o detalhe', async ({ page }) => {
    await gotoApp(page, '/login?redirect=%2Fmercado')
    await login(page)
    const card = page.getByTestId('nft-card').filter({ hasText: 'Sage Nomad #009' })
    await card.hover()
    await card.getByRole('button', { name: 'Adicionar Sage Nomad #009 ao carrinho' }).click()
    await expect(page.getByRole('link', { name: /Carrinho, 1 item/ }).first()).toBeAttached()
    await card.getByRole('button', { name: 'Favoritar Sage Nomad #009' }).click()
    await expect(card.getByRole('button', { name: 'Remover Sage Nomad #009 dos favoritos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page).toHaveURL(/\/mercado/)
  })

  test('cenário vazio exibe estado vazio', async ({ page }) => {
    await gotoApp(page, '/mercado', { scenario: 'empty' })
    await expect(page.getByTestId('catalog-empty')).toBeVisible()
  })

  test('respostas fora de ordem não sobrescrevem o resultado mais recente', async ({ page }) => {
    await gotoApp(page, '/mercado', { scenario: 'out-of-order', latency: 'auto' })
    await expect(page.getByTestId('nft-card').first()).toBeVisible({ timeout: 10_000 })
    // Duas mudanças rápidas: no cenário, a requisição anterior (lenta) chega depois da seguinte (rápida).
    const filters = page.getByTestId('filters')
    await filters.getByRole('button', { name: /Música/ }).click()
    await filters.getByRole('button', { name: /Fotografia/ }).click()
    await expect(page).toHaveURL(/fotografia/)
    await page.waitForTimeout(2200) // garante que a resposta obsoleta já chegou
    const expected = await page.evaluate(async () => {
      const r = await fetch('/api/nfts?category=fotografia&category=musica&pageSize=9')
      return (await r.json()).total as number
    })
    await expect(page.getByTestId('catalog-total')).toHaveText(`${expected} NFTs encontrados`)
  })

  test('skeletons durante carregamento lento, falha e recuperação com nova tentativa', async ({ page }) => {
    await gotoApp(page, '/mercado', { scenario: 'slow', latency: 'auto' })
    await expect(page.getByTestId('catalog-grid')).toHaveAttribute('aria-busy', 'true')
    await expect(page.locator('.skeleton').first()).toBeVisible()
    await expect(page.getByTestId('nft-card').first()).toBeVisible({ timeout: 10_000 })

    await gotoApp(page, '/nft/emerald-ape-042', { scenario: 'server-error' })
    await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível carregar este NFT' })).toBeVisible({
      timeout: 15_000,
    })
    await mockControl(page, '/config', { scenario: 'default' }, 'PUT')
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('nft-title')).toHaveText('Emerald Ape #042')
  })

  test('timeout: cliente aborta a requisição travada e recupera na nova tentativa', async ({ page }) => {
    test.setTimeout(60_000)
    await gotoApp(page, '/nft/emerald-ape-042', { scenario: 'timeout' })
    // Enquanto a 1ª requisição não responde, o skeleton fica visível
    await expect(page.getByTestId('detail-skeleton')).toBeVisible()
    await page.waitForTimeout(3_000)
    await expect(page.getByTestId('detail-skeleton')).toBeVisible()
    // Axios aborta em 10 s; o retry (falha transitória) recebe a resposta
    await expect(page.getByTestId('nft-title')).toHaveText('Emerald Ape #042', { timeout: 20_000 })
  })

  test('falha de conexão mostra feedback acessível', async ({ page }) => {
    await gotoApp(page, '/mercado', { scenario: 'offline' })
    await expect(page.getByRole('alert').filter({ hasText: 'Sem conexão' })).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Detalhe do NFT', () => {
  test('@main acesso direto, edição indisponível e limite de quantidade', async ({ page }) => {
    await gotoApp(page, '/nft/neon-vessel-552')
    await expect(page.getByTestId('nft-title')).toHaveText('Neon Vessel #552')
    // 1/1 desta peça está esgotada nas fixtures (índice 2)
    await page.getByRole('radio', { name: '1/1 (esgotada)' }).click()
    await expect(page.getByTestId('edition-status').first()).toContainText('indisponível')
    // Edição 1/10: limite de 5 por pedido
    await page.getByRole('radio', { name: '1/10' }).click()
    const scope = isMobile(page)
      ? page.locator('.fixed.bottom-0')
      : page.locator('section[aria-labelledby="nft-title"]')
    const plus = scope.getByRole('button', { name: /Aumentar quantidade/ })
    for (let i = 0; i < 6; i++) if (await plus.isEnabled()) await plus.click()
    await expect(scope.getByTestId('qty-value')).toHaveText('5')
    await expect(plus).toBeDisabled()
    await expect(page).toHaveURL(/edicao=1-10/)
  })

  test('NFT inexistente e rota inexistente', async ({ page }) => {
    await gotoApp(page, '/nft/nao-existe-999')
    await expect(page.getByTestId('nft-not-found')).toBeVisible()
    await page.goto('/rota/que/nao/existe')
    await expect(page.getByTestId('not-found')).toBeVisible()
  })
})
