import { USERS, expect, gotoApp, login, mockControl, openLogin, test } from './fixtures'

test.describe('Conta e sessão', () => {
  test('@main cadastro com validação e conflito, login e logout', async ({ page }) => {
    await gotoApp(page, '/register')
    // Validação de formulário
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
    await expect(page.getByText('Mínimo de 3 caracteres')).toBeVisible()
    await expect(page.getByPlaceholder('Nome de usuário')).toHaveAttribute('aria-invalid', 'true')

    // Conflito: e-mail já cadastrado (retornado pela API)
    await page.getByPlaceholder('Nome de usuário').fill('novo.usuario')
    await page.getByPlaceholder('Digite seu e-mail', { exact: true }).fill(USERS.ana.email)
    await page.getByPlaceholder('Senha', { exact: true }).fill('SenhaForte1')
    await page.getByPlaceholder('Confirmar senha').fill('SenhaForte1')
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
    await expect(page.getByText('Este e-mail já está cadastrado')).toBeVisible()

    // Sucesso
    await page.getByPlaceholder('Digite seu e-mail', { exact: true }).fill('novo@kurio.dev')
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
    await expect(page.getByText('Conta criada!')).toBeVisible()

    // Sessão sobrevive a refresh
    await page.goto('/account/profile')
    await page.reload()
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('novo.usuario')

    // Logout limpa sessão e protege rotas privadas
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByText('Você saiu da sua conta')).toBeVisible()
    await page.goto('/account/profile')
    await expect(page).toHaveURL(/\/login\?redirect=/)
  })

  test('@main login inválido, login válido e retorno ao fluxo anterior', async ({ page }) => {
    await gotoApp(page, '/')
    await openLogin(page)
    await page.getByPlaceholder('contato@email.com').fill(USERS.ana.email)
    await page.getByPlaceholder('Senha', { exact: true }).fill('errada123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByTestId('login-error')).toHaveText('E-mail ou senha incorretos.')

    await page.goto('/checkout')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
    await login(page, 'ana')
    // Carrinho vazio: o checkout informa e mantém o usuário no fluxo
    await expect(page).toHaveURL(/\/checkout/)
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  })

  test('expiração de sessão durante a navegação preserva o destino', async ({ page }) => {
    await gotoApp(page, '/login?redirect=%2Faccount%2Fwallets')
    await login(page)
    await expect(page).toHaveURL(/\/account\/wallets/)
    await expect(page.getByTestId('wallet-form-primary')).toBeVisible()
    await mockControl(page, '/session/expire')
    // Próxima chamada autenticada (revalidação ao recarregar) recebe 401 SESSION_EXPIRED
    await page.reload()
    await expect(page).toHaveURL(/\/login\?.*reason=expired/, { timeout: 15_000 })
    await expect(page.getByTestId('session-expired-banner')).toBeVisible()
    await login(page)
    await expect(page).toHaveURL(/\/account\/wallets/)
  })

  test('sessão curta expira com o relógio controlado', async ({ page }) => {
    await page.clock.install()
    await gotoApp(page, '/login?redirect=%2Faccount%2Fprofile', { scenario: 'short-session' })
    await login(page)
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('ana.coleciona')
    await page.clock.fastForward(25_000)
    await page.getByRole('link', { name: 'Carteiras' }).first().click()
    await expect(page).toHaveURL(/reason=expired/)
  })

  test('troca de usuário não expõe dados privados do anterior', async ({ page }) => {
    await gotoApp(page, '/login?redirect=%2Faccount%2Fwallets')
    await login(page, 'ana')
    await expect(page.getByTestId('wallet-form-primary').getByLabel('Endereço da carteira')).toHaveValue(/^0xA91F/)
    await page.getByRole('button', { name: 'Sair' }).click()
    await page.goto('/login?redirect=%2Faccount%2Fwallets')
    await login(page, 'bruno')
    await expect(page.getByTestId('wallet-form-primary').getByLabel('Endereço da carteira')).toHaveValue(/^0x5b2C/)
    await expect(page.getByText('0xA91F')).toHaveCount(0)
    const cache = await page.evaluate(() => localStorage.getItem('kurio:session'))
    expect(cache).toContain('bruno@kurio.dev')
    expect(cache).not.toContain('ana@kurio.dev')
  })

  test('acesso negado (403) é tratado', async ({ page }) => {
    await gotoApp(page, '/login?redirect=%2Faccount%2Fwallets')
    await login(page)
    await expect(page).toHaveURL(/\/account\/wallets/)
    await mockControl(page, '/config', { scenario: 'unauthorized' }, 'PUT')
    await page.reload()
    await expect(page.getByRole('alert').filter({ hasText: 'permissão' })).toBeVisible()
  })
})
