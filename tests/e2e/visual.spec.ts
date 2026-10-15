import { addToCartFromDetail, expect, gotoApp, login, test, waitRealtime } from './fixtures'
import type { Page } from '@playwright/test'

/** Regressão visual com dados estáveis (fixtures determinísticas, latência zero, painel de mocks oculto). */
async function stabilize(page: Page) {
  await page.addStyleTag({
    content: `[data-testid=mock-panel-toggle], [data-sonner-toaster] { display: none !important; } *{ caret-color: transparent !important; }`,
  })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForLoadState('networkidle')
}

test.describe('Regressão visual', () => {
  test('@main início', async ({ page }) => {
    await gotoApp(page, '/')
    await expect(page.getByTestId('nft-card')).toHaveCount(9)
    await stabilize(page)
    await expect(page).toHaveScreenshot('inicio.png', { fullPage: true })
  })

  test('@main detalhe', async ({ page }) => {
    await gotoApp(page, '/nft/emerald-ape-042')
    await expect(page.getByTestId('nft-title')).toBeVisible()
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    await stabilize(page)
    await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true })
  })

  test('@main carrinho', async ({ page }) => {
    await gotoApp(page, '/')
    await addToCartFromDetail(page, 'emerald-ape-042', 2)
    await addToCartFromDetail(page, 'violet-nomad-314', 1)
    await page.goto('/cart')
    await expect(page.getByTestId('cart-item')).toHaveCount(2)
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    await stabilize(page)
    await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true })
  })

  test('@main pagamento', async ({ page }) => {
    await gotoApp(page, '/login?redirect=%2F')
    await login(page)
    await addToCartFromDetail(page, 'emerald-ape-042', 2)
    await page.goto('/checkout')
    await expect(page.getByTestId('checkout-items')).toContainText('Emerald Ape')
    await waitRealtime(page)
    await stabilize(page)
    await expect(page).toHaveScreenshot('pagamento.png', {
      fullPage: true,
      mask: [page.getByTestId('realtime-status')],
    })
  })
})
