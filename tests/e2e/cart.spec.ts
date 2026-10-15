import { addToCartFromDetail, expect, gotoApp, isMobile, login, setScenario, test, waitRealtime } from './fixtures'

test.describe('Favoritos', () => {
  test('favoritar com atualização otimista, falha com rollback e persistência', async ({ page }) => {
    await gotoApp(page, '/login?redirect=%2Fnft%2Femerald-ape-042')
    await login(page)
    await expect(page.getByTestId('nft-title')).toBeVisible()
    const fav = page.getByRole('button', { name: /Favoritar|Favoritado/ }).last()
    await expect(fav).toHaveAttribute('aria-pressed', 'false')

    // Falha: estado volta (rollback) e o usuário é avisado
    await setScenario(page, 'favorites-fail')
    await fav.click()
    await expect(page.getByText(/Não foi possível favoritar/)).toBeVisible()
    await expect(fav).toHaveAttribute('aria-pressed', 'false')

    // Sucesso persiste após refresh
    await setScenario(page, 'default')
    await fav.click()
    await expect(fav).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText(/adicionado aos favoritos/)).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: /Favoritado/ }).last()).toHaveAttribute('aria-pressed', 'true')

    // Lista de interesse mostra o favorito; remover pelo coração tira da lista
    await page.goto('/account/favorites')
    const grid = page.getByTestId('favorites-grid')
    await expect(grid.getByText('Emerald Ape #042')).toBeVisible()
    await expect(grid.getByText('Neon Vessel #552')).toBeVisible() // favorito pré-existente da Ana nas fixtures
    await grid.getByRole('button', { name: 'Remover Emerald Ape #042 dos favoritos' }).click()
    await expect(grid.getByText('Emerald Ape #042')).toHaveCount(0)
    await grid.getByRole('button', { name: 'Remover Neon Vessel #552 dos favoritos' }).click()
    await expect(page.getByTestId('favorites-empty')).toBeVisible()
  })
})

test.describe('Carrinho', () => {
  test('@main quantidades, remoção, cupom e persistência após refresh/login', async ({ page }) => {
    await gotoApp(page, '/')
    await addToCartFromDetail(page, 'emerald-ape-042', 2)
    await addToCartFromDetail(page, 'violet-nomad-314', 1)
    await page.goto('/cart')
    const items = page.getByTestId('cart-item')
    await expect(items).toHaveCount(2)
    await expect(page.getByTestId('summary-subtotal')).toHaveText('3.77 ETH') // 2×1.19 + 1.39
    await expect(page.getByTestId('summary-total')).toHaveText('3.786 ETH') // + 0.016

    // Quantidade (atualização otimista)
    const row = items.filter({ hasText: 'Violet Nomad #314' })
    const scope = isMobile(page) ? row.locator('.md\\:hidden').first() : row
    await scope.getByRole('button', { name: 'Aumentar quantidade' }).click()
    await expect(page.getByTestId('summary-subtotal')).toHaveText('5.16 ETH')

    // Cupom inválido / expirado / válido / remoção
    await page.getByTestId('coupon-input').fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('coupon-error')).toHaveText(/Código promocional inválido/)
    await page.getByTestId('coupon-input').fill('VERAO2025')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('coupon-error')).toHaveText(/expirou/)
    await page.getByTestId('coupon-input').fill('kurio10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('coupon-applied')).toContainText('KURIO10')
    await expect(page.getByTestId('summary-discount')).toHaveText('(-) 0.516 ETH')
    await expect(page.getByTestId('summary-total')).toHaveText('4.66 ETH') // 5.16 - 0.516 + 0.016
    await page.getByRole('button', { name: 'Remover cupom KURIO10' }).click()
    await expect(page.getByTestId('summary-total')).toHaveText('5.176 ETH')

    // Remoção
    await page.getByRole('button', { name: 'Remover Emerald Ape #042 do carrinho' }).click()
    await expect(items).toHaveCount(1)

    // Persistência após refresh (visitante)
    await page.reload()
    await expect(items).toHaveCount(1)

    // Ao autenticar, itens do visitante são preservados
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/login/)
    await login(page)
    await expect(page).toHaveURL(/\/checkout/)
    await expect(page.getByTestId('checkout-items')).toContainText('Violet Nomad #314')
    await page.goto('/cart')
    await expect(items).toHaveCount(1)
    await expect(items.first()).toContainText('Violet Nomad #314')
  })

  test('disponibilidade limita a quantidade', async ({ page }) => {
    await gotoApp(page, '/')
    await addToCartFromDetail(page, 'emerald-ape-042', 1)
    await page.goto('/cart')
    await waitRealtime(page)
    // Simula estoque baixo via evento e API
    await page.evaluate(() =>
      fetch('/api/__mock/nfts/emerald-ape-042', {
        method: 'POST',
        body: JSON.stringify({ editionId: '1-50', available: 1 }),
      }),
    )
    const row = page.getByTestId('cart-item').first()
    await expect(row.locator('button[aria-label^="Aumentar quantidade"]:visible')).toBeDisabled()
    await expect(row.locator('button[aria-label^="Aumentar quantidade"]:visible')).toHaveAttribute(
      'aria-label',
      /limite de 1/,
    )
  })
})
