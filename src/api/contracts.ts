/**
 * Contratos REST e de eventos compartilhados entre:
 *  - cliente (Axios + TanStack Query) — respostas são validadas com Zod em runtime;
 *  - camada de mocks (MSW) — handlers constroem respostas tipadas a partir destes tipos.
 *
 * Valores em ETH trafegam SEMPRE como string decimal (ex.: "1.19").
 * Quantidades são inteiras.
 */
import { z } from 'zod'

/* ------------------------------------------------------------------ */
/* Primitivos                                                          */
/* ------------------------------------------------------------------ */

export const ethSchema = z.string().regex(/^\d+(\.\d+)?$/, 'Valor ETH deve ser string decimal')
export type Eth = z.infer<typeof ethSchema>

export const networkSchema = z.enum(['ethereum', 'polygon', 'solana'])
export type Network = z.infer<typeof networkSchema>

export const NETWORK_LABEL: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

export const raritySchema = z.enum(['raro', 'lendario', 'comum'])
export type Rarity = z.infer<typeof raritySchema>

export const categorySchema = z.enum([
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
])
export type Category = z.infer<typeof categorySchema>

export const CATEGORY_LABEL: Record<Category, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
}

export const sortSchema = z.enum(['recent', 'price-asc', 'price-desc', 'name'])
export type CatalogSort = z.infer<typeof sortSchema>
export const SORT_LABEL: Record<CatalogSort, string> = {
  recent: 'Listados recentemente',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  name: 'Nome (A–Z)',
}

export const tabSchema = z.enum(['all', 'new', 'trending'])
export type CatalogTab = z.infer<typeof tabSchema>

export const walletProviderSchema = z.enum(['metamask', 'walletconnect', 'coinbase'])
export type WalletProvider = z.infer<typeof walletProviderSchema>
export const WALLET_PROVIDER_LABEL: Record<WalletProvider, string> = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase Wallet',
}

/* ------------------------------------------------------------------ */
/* Erros                                                               */
/* ------------------------------------------------------------------ */

export const errorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'INVALID_CREDENTIALS',
  'FORBIDDEN',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'USERNAME_TAKEN',
  'AVAILABILITY_CONFLICT',
  'QUOTE_CHANGED',
  'QUOTE_EXPIRED',
  'IDEMPOTENCY_CONFLICT',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'WALLET_REJECTED',
  'WALLET_NOT_CONNECTED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
])
export type ErrorCode = z.infer<typeof errorCodeSchema>

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    fieldErrors: z.record(z.string(), z.string()).optional(),
    details: z.unknown().optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>

/* ------------------------------------------------------------------ */
/* NFTs                                                                */
/* ------------------------------------------------------------------ */

export const editionSchema = z.object({
  id: z.string(),
  label: z.string(),
  supply: z.number().int().nullable(),
  available: z.number().int().nonnegative(),
  maxPerOrder: z.number().int().positive(),
  price: ethSchema,
})
export type Edition = z.infer<typeof editionSchema>

export const nftSummarySchema = z.object({
  id: z.string(),
  tokenId: z.string(),
  name: z.string(),
  image: z.string(),
  imageAlt: z.string(),
  price: ethSchema,
  compareAtPrice: ethSchema.nullable(),
  rarity: z.enum(['raro', 'lendario']).nullable(),
  category: categorySchema,
  network: networkSchema,
  soldOut: z.boolean(),
  version: z.number().int(),
})
export type NftSummary = z.infer<typeof nftSummarySchema>

export const nftSchema = nftSummarySchema.extend({
  collectionName: z.string(),
  creator: z.string(),
  description: z.string(),
  longDescription: z.array(z.string()),
  attributes: z.array(z.string()),
  gallery: z.array(z.string()),
  rating: z.number(),
  reviewsCount: z.number().int(),
  editions: z.array(editionSchema),
  contractAddress: z.string(),
  royaltiesPct: z.number(),
  listedAt: z.string(),
})
export type Nft = z.infer<typeof nftSchema>

export const catalogQuerySchema = z.object({
  q: z.string().optional(),
  categories: z.array(categorySchema).optional(),
  networks: z.array(networkSchema).optional(),
  minPrice: ethSchema.optional(),
  maxPrice: ethSchema.optional(),
  sort: sortSchema.optional(),
  tab: tabSchema.optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(48).optional(),
  rarity: raritySchema.optional(),
})
export type CatalogQuery = z.infer<typeof catalogQuerySchema>

export const facetSchema = z.object({ value: z.string(), label: z.string(), count: z.number().int() })
export const catalogResponseSchema = z.object({
  items: z.array(nftSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  facets: z.object({
    categories: z.array(facetSchema),
    networks: z.array(facetSchema),
    priceRange: z.object({ min: ethSchema, max: ethSchema }),
  }),
})
export type CatalogResponse = z.infer<typeof catalogResponseSchema>

/* ------------------------------------------------------------------ */
/* Sessão e conta                                                      */
/* ------------------------------------------------------------------ */

export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  ensName: z.string().nullable(),
  walletNickname: z.string().nullable(),
})
export type User = z.infer<typeof userSchema>

export const sessionSchema = z.object({
  token: z.string(),
  expiresAt: z.string(),
  user: userSchema,
})
export type Session = z.infer<typeof sessionSchema>

export const loginInputSchema = z.object({
  email: z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
})
export type LoginInput = z.infer<typeof loginInputSchema>

export const passwordRule = z
  .string()
  .min(8, 'A senha precisa ter ao menos 8 caracteres')
  .regex(/[A-Za-z]/, 'Inclua ao menos uma letra')
  .regex(/\d/, 'Inclua ao menos um número')

export const usernameRule = z
  .string()
  .trim()
  .min(3, 'Mínimo de 3 caracteres')
  .max(24, 'Máximo de 24 caracteres')
  .regex(/^[a-z0-9_.]+$/i, 'Use apenas letras, números, ponto e _')

export const registerInputSchema = z
  .object({
    username: usernameRule,
    email: z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido'),
    password: passwordRule,
    confirmPassword: z.string().min(1, 'Confirme a senha'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem',
  })
export type RegisterInput = z.infer<typeof registerInputSchema>

export const ensRule = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]{3,32}$/i, 'Use 3–32 letras, números ou hífen')

export const profileInputSchema = z.object({
  displayName: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(40, 'Máximo de 40 caracteres'),
  username: usernameRule,
  email: z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido'),
  ensName: ensRule,
  walletNickname: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(32, 'Máximo de 32 caracteres'),
})
export type ProfileInput = z.infer<typeof profileInputSchema>

export const passwordChangeInputSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: passwordRule,
    confirmPassword: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'A nova senha deve ser diferente da atual',
  })
export type PasswordChangeInput = z.infer<typeof passwordChangeInputSchema>

/* ------------------------------------------------------------------ */
/* Carteiras                                                           */
/* ------------------------------------------------------------------ */

export const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/
export const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export const walletSchema = z.object({
  id: z.string(),
  role: z.enum(['primary', 'secondary']),
  displayName: z.string(),
  nickname: z.string(),
  network: networkSchema,
  address: z.string(),
  secondaryAddress: z.string().nullable(),
  provider: walletProviderSchema,
  profileName: z.string(),
  referralCode: z.string(),
  email: z.string(),
  ensName: z.string(),
  updatedAt: z.string(),
})
export type Wallet = z.infer<typeof walletSchema>

export const walletInputSchema = z
  .object({
    role: z.enum(['primary', 'secondary']),
    displayName: z.string().trim().min(2, 'Mínimo de 2 caracteres'),
    nickname: z.string().trim().min(2, 'Mínimo de 2 caracteres'),
    network: networkSchema,
    address: z.string().trim().min(1, 'Informe o endereço da carteira'),
    secondaryAddress: z.string().trim().optional().or(z.literal('')),
    provider: walletProviderSchema,
    profileName: z.string().trim().min(2, 'Mínimo de 2 caracteres'),
    referralCode: z
      .string()
      .trim()
      .regex(/^[A-Z0-9]{4,12}$/i, 'Use 4–12 letras ou números'),
    email: z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido'),
    ensName: ensRule,
  })
  .superRefine((v, ctx) => {
    const re = v.network === 'solana' ? SOLANA_ADDRESS : EVM_ADDRESS
    if (!re.test(v.address)) {
      ctx.addIssue({
        code: 'custom',
        path: ['address'],
        message:
          v.network === 'solana'
            ? 'Endereço Solana inválido (base58, 32–44 caracteres)'
            : 'Endereço inválido: use 0x seguido de 40 caracteres hexadecimais',
      })
    }
  })
export type WalletInput = z.infer<typeof walletInputSchema>

/* ------------------------------------------------------------------ */
/* Carrinho e cotação                                                  */
/* ------------------------------------------------------------------ */

export const cartIssueSchema = z.enum(['PRICE_CHANGED', 'INSUFFICIENT_AVAILABILITY', 'SOLD_OUT'])
export type CartIssue = z.infer<typeof cartIssueSchema>

export const couponSchema = z.object({ code: z.string(), description: z.string() })

export const summarySchema = z.object({
  subtotal: ethSchema,
  discount: ethSchema,
  networkFee: ethSchema,
  total: ethSchema,
  coupon: couponSchema.nullable(),
})
export type Summary = z.infer<typeof summarySchema>

export const cartItemSchema = z.object({
  id: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  editionLabel: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: ethSchema,
  acknowledgedUnitPrice: ethSchema,
  lineTotal: ethSchema,
  available: z.number().int().nonnegative(),
  maxPerOrder: z.number().int().positive(),
  issues: z.array(cartIssueSchema),
})
export type CartItem = z.infer<typeof cartItemSchema>

export const cartSchema = z.object({
  id: z.string(),
  owner: z.enum(['guest', 'user']),
  items: z.array(cartItemSchema),
  itemCount: z.number().int(),
  summary: summarySchema,
  updatedAt: z.string(),
})
export type Cart = z.infer<typeof cartSchema>

export const addCartItemInputSchema = z.object({
  nftId: z.string(),
  editionId: z.string(),
  quantity: z.number().int().positive(),
})
export type AddCartItemInput = z.infer<typeof addCartItemInputSchema>

export const quoteLineSchema = z.object({
  nftId: z.string(),
  editionId: z.string(),
  editionLabel: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: ethSchema,
  lineTotal: ethSchema,
})
export type QuoteLine = z.infer<typeof quoteLineSchema>

export const quoteSchema = summarySchema.extend({
  id: z.string(),
  fingerprint: z.string(),
  network: networkSchema,
  lines: z.array(quoteLineSchema),
  issues: z.array(z.object({ nftId: z.string(), editionId: z.string(), issue: cartIssueSchema })),
  createdAt: z.string(),
  expiresAt: z.string(),
})
export type Quote = z.infer<typeof quoteSchema>

export const quoteInputSchema = z.object({ network: networkSchema })
export type QuoteInput = z.infer<typeof quoteInputSchema>

/* ------------------------------------------------------------------ */
/* Pedidos                                                             */
/* ------------------------------------------------------------------ */

export const orderStatusSchema = z.enum(['pending', 'confirmed', 'declined'])
export type OrderStatus = z.infer<typeof orderStatusSchema>

export const buyerSchema = z.object({
  displayName: z.string(),
  username: z.string(),
  profileName: z.string(),
  email: z.string(),
  ensName: z.string(),
  referralCode: z.string(),
  note: z.string().optional(),
})
export type Buyer = z.infer<typeof buyerSchema>

export const orderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: orderStatusSchema,
  quoteId: z.string(),
  network: networkSchema,
  lines: z.array(quoteLineSchema),
  subtotal: ethSchema,
  discount: ethSchema,
  networkFee: ethSchema,
  total: ethSchema,
  coupon: couponSchema.nullable(),
  wallet: z.object({
    id: z.string(),
    label: z.string(),
    provider: walletProviderSchema,
    address: z.string(),
  }),
  buyer: buyerSchema,
  txHash: z.string().nullable(),
  explorerUrl: z.string().nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int(),
})
export type Order = z.infer<typeof orderSchema>

export const createOrderInputSchema = z.object({
  quoteId: z.string(),
  quoteFingerprint: z.string(),
  walletId: z.string(),
  walletSessionId: z.string(),
  network: networkSchema,
  buyer: buyerSchema,
})
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>

export const walletSessionSchema = z.object({
  id: z.string(),
  walletId: z.string(),
  /** Aplicativo usado para conectar (o mesmo endereço pode conectar via WalletConnect, extensão etc.). */
  provider: walletProviderSchema,
  network: networkSchema,
  connectedAt: z.string(),
})
export type WalletSession = z.infer<typeof walletSessionSchema>

/* ------------------------------------------------------------------ */
/* Favoritos                                                           */
/* ------------------------------------------------------------------ */

export const favoritesSchema = z.object({ nftIds: z.array(z.string()) })
export type Favorites = z.infer<typeof favoritesSchema>

/* ------------------------------------------------------------------ */
/* Eventos Socket.IO                                                   */
/* ------------------------------------------------------------------ */

export const nftUpdatedPayloadSchema = z.object({
  nftId: z.string(),
  price: ethSchema,
  compareAtPrice: ethSchema.nullable(),
  soldOut: z.boolean(),
  editions: z.array(z.object({ id: z.string(), available: z.number().int(), price: ethSchema })),
  reason: z.enum(['price', 'availability', 'both']),
})

export const realtimeEventSchema = z.discriminatedUnion('type', [
  z.object({
    eventId: z.string(),
    type: z.literal('nft.updated'),
    resourceId: z.string(),
    version: z.number().int(),
    occurredAt: z.string(),
    payload: nftUpdatedPayloadSchema,
  }),
  z.object({
    eventId: z.string(),
    type: z.literal('order.updated'),
    resourceId: z.string(),
    version: z.number().int(),
    occurredAt: z.string(),
    userId: z.string(),
    payload: orderSchema,
  }),
])
export type RealtimeEvent = z.infer<typeof realtimeEventSchema>
export type NftUpdatedEvent = Extract<RealtimeEvent, { type: 'nft.updated' }>
export type OrderUpdatedEvent = Extract<RealtimeEvent, { type: 'order.updated' }>

/** Nome do evento Socket.IO usado como "envelope" para todos os eventos de domínio. */
export const SOCKET_EVENTS = ['nft.updated', 'order.updated'] as const
