import { test as base, expect, type Page } from '@playwright/test'

export const USERS = {
  ana: { email: 'ana@kurio.dev', password: 'Kurio2026', name: 'Ana Ribeiro' },
  bruno: { email: 'bruno@kurio.dev', password: 'Kurio2026', name: 'Bruno Tavares' },
} as const

export type Scenario =
  | 'default'
  | 'empty'
  | 'slow'
  | 'variable-latency'
  | 'out-of-order'
  | 'offline'
  | 'timeout'
  | 'server-error'
  | 'flaky'
  | 'unauthorized'
  | 'short-session'
  | 'favorites-fail'
  | 'checkout-price-change'
  | 'checkout-sold-out'
  | 'order-timeout'
  | 'payment-declined'
  | 'wallet-rejected'

export interface GotoOptions {
  scenario?: Scenario
  latency?: 'none' | 'auto'
  orderMs?: number
}

/** Abre a app com cenário/latência controlados. Cada teste tem contexto (storage) isolado. */
export async function gotoApp(page: Page, path = '/', opts: GotoOptions = {}) {
  const url = new URL(path, 'http://x')
  url.searchParams.set('mock-scenario', opts.scenario ?? 'default')
  url.searchParams.set('mock-latency', opts.latency ?? 'none')
  url.searchParams.set('mock-order-ms', String(opts.orderMs ?? 600))
  await page.goto(url.pathname + url.search)
  await expect(page.locator('#conteudo')).toBeVisible()
}

/** Chama os endpoints de controle da simulação (passam pelo MSW dentro da página). */
export async function mockControl(page: Page, path: string, body?: unknown, method = 'POST') {
  return page.evaluate(
    async ({ path, body, method }) => {
      const res = await fetch(`/api/__mock${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      return res.json()
    },
    { path, body, method },
  )
}

export async function setScenario(page: Page, scenario: Scenario) {
  await mockControl(page, '/config', { scenario }, 'PUT')
}

export function isMobile(page: Page) {
  return (page.viewportSize()?.width ?? 1440) < 768
}

export async function login(page: Page, user: keyof typeof USERS = 'ana') {
  const u = USERS[user]
  await page.getByPlaceholder('contato@email.com').fill(u.email)
  await page.getByPlaceholder('Senha', { exact: true }).fill(u.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

/** Vai ao login pela navegação da UI (cabeçalho no desktop, barra inferior no mobile). */
export async function openLogin(page: Page) {
  if (isMobile(page))
    await page.getByRole('navigation', { name: 'Navegação inferior' }).getByRole('link', { name: 'Entrar' }).click()
  else await page.getByRole('banner').getByRole('link', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/login/)
}

export async function waitRealtime(page: Page) {
  await expect(page.getByTestId('realtime-status').first()).toHaveAttribute('data-status', 'connected')
}

export async function addToCartFromDetail(page: Page, nftId: string, qty = 1) {
  await page.goto(`/nft/${nftId}`)
  await expect(page.getByTestId('nft-title')).toBeVisible()
  const scope = isMobile(page) ? page.locator('.fixed.bottom-0') : page.locator('section[aria-labelledby="nft-title"]')
  for (let i = 1; i < qty; i++) await scope.getByRole('button', { name: /Aumentar quantidade/ }).click()
  if (isMobile(page)) await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  else {
    await page.getByRole('button', { name: 'Comprar', exact: true }).click()
    await expect(page).toHaveURL(/\/cart/)
  }
  await expect(page.getByText(/adicionada|adicionadas/).first()).toBeVisible()
}

export const test = base
export { expect }
