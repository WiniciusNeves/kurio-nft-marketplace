/**
 * Funções de transporte REST — única camada que conhece URLs e formatos HTTP.
 * Toda resposta é validada contra o contrato (Zod) antes de chegar ao cache.
 */
import { z } from 'zod'
import { http } from './http'
import {
  cartSchema,
  catalogResponseSchema,
  favoritesSchema,
  nftSchema,
  nftSummarySchema,
  orderSchema,
  quoteSchema,
  sessionSchema,
  userSchema,
  walletSchema,
  walletSessionSchema,
  type AddCartItemInput,
  type CatalogQuery,
  type CreateOrderInput,
  type LoginInput,
  type Network,
  type PasswordChangeInput,
  type ProfileInput,
  type RegisterInput,
  type WalletInput,
  type WalletProvider,
} from './contracts'

type Opts = { signal?: AbortSignal }

export function catalogParams(q: CatalogQuery) {
  const p = new URLSearchParams()
  if (q.q) p.set('q', q.q)
  q.categories?.forEach((c) => p.append('category', c))
  q.networks?.forEach((n) => p.append('network', n))
  if (q.minPrice) p.set('minPrice', q.minPrice)
  if (q.maxPrice) p.set('maxPrice', q.maxPrice)
  if (q.sort) p.set('sort', q.sort)
  if (q.tab) p.set('tab', q.tab)
  if (q.page) p.set('page', String(q.page))
  if (q.pageSize) p.set('pageSize', String(q.pageSize))
  return p
}

export const api = {
  /* Catálogo */
  listNfts: async (query: CatalogQuery, { signal }: Opts = {}) =>
    catalogResponseSchema.parse((await http.get('/nfts', { params: catalogParams(query), signal })).data),
  getNft: async (id: string, { signal }: Opts = {}) =>
    nftSchema.parse((await http.get(`/nfts/${encodeURIComponent(id)}`, { signal })).data),
  relatedNfts: async (id: string, { signal }: Opts = {}) =>
    z
      .object({ items: z.array(nftSummarySchema) })
      .parse((await http.get(`/nfts/${encodeURIComponent(id)}/related`, { signal })).data).items,

  /* Sessão */
  register: async (input: RegisterInput) => sessionSchema.parse((await http.post('/auth/register', input)).data),
  login: async (input: LoginInput) => sessionSchema.parse((await http.post('/auth/login', input)).data),
  session: async ({ signal }: Opts = {}) => sessionSchema.parse((await http.get('/auth/session', { signal })).data),
  logout: async () => {
    await http.post('/auth/logout')
  },

  /* Perfil */
  getProfile: async ({ signal }: Opts = {}) => userSchema.parse((await http.get('/me/profile', { signal })).data),
  updateProfile: async (input: ProfileInput) => userSchema.parse((await http.put('/me/profile', input)).data),
  uploadAvatar: async (file: File) => {
    const form = new FormData()
    form.append('avatar', file)
    return userSchema.parse((await http.post('/me/avatar', form)).data)
  },
  removeAvatar: async () => userSchema.parse((await http.delete('/me/avatar')).data),
  changePassword: async (input: PasswordChangeInput) => {
    await http.put('/me/password', input)
  },

  /* Carteiras */
  listWallets: async ({ signal }: Opts = {}) =>
    z.object({ items: z.array(walletSchema) }).parse((await http.get('/me/wallets', { signal })).data).items,
  createWallet: async (input: WalletInput) => walletSchema.parse((await http.post('/me/wallets', input)).data),
  updateWallet: async (id: string, input: WalletInput) =>
    walletSchema.parse((await http.put(`/me/wallets/${id}`, input)).data),
  connectWallet: async (id: string, network: Network, provider: WalletProvider) =>
    walletSessionSchema.parse((await http.post(`/me/wallets/${id}/connect`, { network, provider })).data),
  disconnectWallet: async (sessionId: string) => {
    await http.delete(`/me/wallet-sessions/${sessionId}`)
  },

  /* Favoritos */
  favorites: async ({ signal }: Opts = {}) => favoritesSchema.parse((await http.get('/me/favorites', { signal })).data),
  favoriteItems: async ({ signal }: Opts = {}) =>
    z.object({ items: z.array(nftSummarySchema) }).parse((await http.get('/me/favorites/items', { signal })).data)
      .items,
  addFavorite: async (nftId: string) => favoritesSchema.parse((await http.put(`/me/favorites/${nftId}`)).data),
  removeFavorite: async (nftId: string) => favoritesSchema.parse((await http.delete(`/me/favorites/${nftId}`)).data),

  /* Carrinho */
  cart: async ({ signal }: Opts = {}) => cartSchema.parse((await http.get('/cart', { signal })).data),
  addToCart: async (input: AddCartItemInput) => cartSchema.parse((await http.post('/cart/items', input)).data),
  updateCartItem: async (itemId: string, quantity: number) =>
    cartSchema.parse((await http.patch(`/cart/items/${itemId}`, { quantity })).data),
  removeCartItem: async (itemId: string) => cartSchema.parse((await http.delete(`/cart/items/${itemId}`)).data),
  acknowledgeCart: async () => cartSchema.parse((await http.post('/cart/acknowledge')).data),
  applyCoupon: async (code: string) => cartSchema.parse((await http.put('/cart/coupon', { code })).data),
  removeCoupon: async () => cartSchema.parse((await http.delete('/cart/coupon')).data),
  mergeCart: async (guestCartId: string) => cartSchema.parse((await http.post('/cart/merge', { guestCartId })).data),

  /* Cotação e pedidos */
  quote: async (network: Network) => quoteSchema.parse((await http.post('/quote', { network })).data),
  createOrder: async (input: CreateOrderInput, idempotencyKey: string) =>
    orderSchema.parse((await http.post('/orders', input, { headers: { 'Idempotency-Key': idempotencyKey } })).data),
  getOrder: async (id: string, { signal }: Opts = {}) =>
    orderSchema.parse((await http.get(`/orders/${id}`, { signal })).data),
  listOrders: async (status?: 'pending' | 'confirmed' | 'declined', { signal }: Opts = {}) =>
    z.object({ items: z.array(orderSchema) }).parse((await http.get('/orders', { params: { status }, signal })).data)
      .items,
}
