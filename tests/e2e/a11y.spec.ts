import { expect, gotoApp, login, test } from './fixtures'

test.describe('Acessibilidade', () => {
  test('@main navegação por teclado com foco visível e link de pular conteúdo', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Teclado físico: verificado no desktop')
    await gotoApp(page, '/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#conteudo')).toBeFocused()
    // Tab chega a um card e Enter navega para o detalhe
    const firstCard = page.getByTestId('nft-card').first().getByRole('link').first()
    await firstCard.focus()
    const outline = await firstCard.evaluate(
      (el) => getComputedStyle(el).textDecorationLine + getComputedStyle(el).outlineStyle,
    )
    expect(outline).toMatch(/underline|solid|auto/)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/nft\//)
  })

  test('foco preso em diálogo e devolvido ao fechar (Esc)', async ({ page }) => {
    await gotoApp(page, '/nft/emerald-ape-042')
    const trigger = page.getByRole('button', { name: 'Ampliar imagem' })
    await trigger.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('drawer de filtros (mobile) prende o foco', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoApp(page, '/mercado')
    await page.getByRole('button', { name: /^Filtros/ }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('formulários: labels, erros associados e foco no primeiro inválido', async ({ page }) => {
    await gotoApp(page, '/login?redirect=%2Faccount%2Fwallets')
    await login(page)
    const form = page.getByTestId('wallet-form-primary')
    await form.getByLabel('Endereço da carteira').fill('')
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    const input = form.getByLabel('Endereço da carteira')
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await input.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`#${describedBy!.split(' ')[0]}`)).toContainText('Informe o endereço')
    await expect(input).toBeFocused()
  })

  test('sem overflow horizontal em 320, 390, 768 e 1440 px', async ({ page }) => {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of ['/', '/mercado', '/nft/emerald-ape-042', '/cart', '/login', '/register']) {
        await gotoApp(page, path)
        await page.waitForLoadState('networkidle')
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, `${path} @ ${width}px`).toBeLessThanOrEqual(0)
      }
    }
  })

  test('zoom de 200%: sem overflow horizontal e conteúdo principal acessível', async ({ page }) => {
    // Zoom de 200% numa janela de 1280 px equivale a um viewport de 640 px CSS (reflow — WCAG 1.4.10).
    await page.setViewportSize({ width: 640, height: 450 })
    for (const path of ['/', '/nft/emerald-ape-042', '/cart', '/login']) {
      await gotoApp(page, path)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, `${path} @ 200%`).toBeLessThanOrEqual(0)
      await expect(page.locator('h1').first()).toBeAttached()
    }
  })

  test('contas: telas privadas sem overflow no mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoApp(page, '/login?redirect=%2Faccount%2Fprofile')
    await login(page)
    for (const path of ['/account/profile', '/account/wallets']) {
      await page.goto(path)
      await expect(page.getByRole('navigation', { name: 'Minha conta' })).toBeVisible()
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, path).toBeLessThanOrEqual(0)
    }
  })

  test('imagens relevantes têm texto alternativo', async ({ page }) => {
    await gotoApp(page, '/mercado')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    const missing = await page
      .locator('[data-testid=nft-card] img')
      .evaluateAll((imgs) => imgs.filter((i) => !(i as HTMLImageElement).alt).length)
    expect(missing).toBe(0)
  })
})
