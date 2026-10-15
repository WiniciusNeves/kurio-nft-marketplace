import path from 'node:path'
import { expect, gotoApp, login, test } from './fixtures'

test.describe('Perfil e carteiras', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page, '/login?redirect=%2Faccount%2Fprofile')
    await login(page)
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Ribeiro')
  })

  test('edição de perfil com validação, persistência após refresh e avatar', async ({ page }) => {
    await page.getByLabel('Nome de exibição').fill('A')
    await page.getByTestId('profile-save').click()
    await expect(page.getByText('Mínimo de 2 caracteres')).toBeVisible()
    await page.getByLabel('Nome de exibição').fill('Ana R. Colecionadora')
    // Conflito vindo da API (username de outro usuário)
    await page.getByLabel('Nome de usuário').fill('bruno_nft')
    await page.getByTestId('profile-save').click()
    await expect(page.getByText('Este nome de usuário já está em uso')).toBeVisible()
    await page.getByLabel('Nome de usuário').fill('ana.coleciona')
    await page.getByTestId('profile-save').click()
    await expect(page.getByText('Perfil salvo')).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana R. Colecionadora')

    // Avatar inválido e válido
    await page
      .getByTestId('avatar-input')
      .setInputFiles({ name: 'doc.txt', mimeType: 'text/plain', buffer: Buffer.from('x') })
    await expect(page.getByText('Use PNG, JPG, WEBP ou GIF')).toBeVisible()
    await page.getByTestId('avatar-input').setInputFiles(path.resolve('public/nfts/golden-beat-thumb.webp'))
    await expect(page.getByTestId('avatar-img')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('avatar-img')).toBeVisible()
    await page.getByRole('button', { name: 'Remover' }).click()
    await expect(page.getByTestId('avatar-img')).toHaveCount(0)
  })

  test('alteração de senha com erro da API e sucesso', async ({ page }) => {
    await page.getByLabel('Senha atual').fill('errada000')
    await page.getByLabel('Nova senha', { exact: true }).fill('NovaSenha1')
    await page.getByLabel('Confirmar nova senha').fill('Outra1234')
    await page.getByTestId('profile-save').click()
    await expect(page.getByText('As senhas não coincidem')).toBeVisible()
    await page.getByLabel('Confirmar nova senha').fill('NovaSenha1')
    await page.getByTestId('profile-save').click()
    await expect(page.getByText('Senha atual incorreta').first()).toBeVisible()
    await page.getByLabel('Senha atual').fill('Kurio2026')
    await page.getByTestId('profile-save').click()
    await expect(page.getByText('Senha alterada')).toBeVisible()
    // Nova senha passa a valer
    await page.getByRole('button', { name: 'Sair' }).click()
    await page.goto('/login')
    await page.getByPlaceholder('contato@email.com').fill('ana@kurio.dev')
    await page.getByPlaceholder('Senha', { exact: true }).fill('NovaSenha1')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByText('Bem-vindo de volta!')).toBeVisible()
  })

  test('carteiras principal e secundária com validação', async ({ page }) => {
    await page.getByRole('link', { name: 'Carteiras' }).first().click()
    const primary = page.getByTestId('wallet-form-primary')
    await primary.getByLabel('Endereço da carteira').fill('0x123')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(primary.getByText('Endereço inválido')).toBeVisible()
    await primary.getByLabel('Endereço da carteira').fill('0x' + 'b'.repeat(40))
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira principal salva')).toBeVisible()

    await page.getByRole('button', { name: 'Adicionar' }).click()
    const secondary = page.getByTestId('wallet-form-secondary')
    await secondary.getByLabel('Apelido da carteira').fill('Reserva')
    await secondary.getByLabel('Rede').click()
    await page.getByRole('option', { name: 'Polygon' }).click()
    await secondary.getByLabel('Nome do perfil').fill('anareserva')
    await secondary.getByLabel('Endereço da carteira').fill('0x' + 'c'.repeat(40))
    await secondary.getByLabel('Tipo de carteira').click()
    await page.getByRole('option', { name: 'WalletConnect' }).click()
    await secondary.getByLabel('Código de indicação').fill('RESERVA1')
    await secondary.getByLabel('Nome ENS').fill('nova-kurio')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira secundária salva')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('wallet-form-secondary').getByLabel('Apelido da carteira')).toHaveValue('Reserva')
    await expect(page.getByTestId('wallet-form-primary').getByLabel('Endereço da carteira')).toHaveValue(
      '0x' + 'b'.repeat(40),
    )
  })
})
