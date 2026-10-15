/**
 * "Banco" da API simulada.
 * Estado único e consistente entre catálogo, favoritos, carrinho, perfil, carteiras e pedidos.
 * Persistido em localStorage para sobreviver a refresh; `resetDb()` restaura o cenário conhecido.
 */
import type {
  Cart,
  CartIssue,
  CartItem,
  Network,
  Order,
  Quote,
  QuoteLine,
  Summary,
  User,
  Wallet,
  WalletSession,
} from '@/api/contracts'
import { eth } from '@/lib/eth'
import { COUPONS, NETWORK_FEES, SEED_USERS, buildNfts, type SeedNft } from './fixtures'
import { hashPassword } from './crypto'

const STORAGE_KEY = 'kurio:mock:db'
const SCHEMA_VERSION = 4

export interface DbUser extends User {
  passwordHash: string
  passwordSalt: string
}
export interface DbCartItem {
  id: string
  nftId: string
  editionId: string
  quantity: number
  acknowledgedUnitPrice: string
}
export interface DbCart {
  id: string
  userId: string | null
  items: DbCartItem[]
  couponCode: string | null
  updatedAt: string
}
export interface DbSession {
  token: string
  userId: string
  expiresAt: string
  revoked: boolean
}
export interface DbOrder extends Order {
  processAt: number
  cartId: string
}
export interface DbState {
  schemaVersion: number
  nfts: SeedNft[]
  users: DbUser[]
  sessions: DbSession[]
  carts: DbCart[]
  favorites: Record<string, string[]>
  wallets: Array<Wallet & { userId: string }>
  walletSessions: Array<WalletSession & { userId: string }>
  quotes: Array<Quote & { userId: string; cartId: string }>
  orders: DbOrder[]
  idempotency: Record<string, { userId: string; bodyHash: string; orderId: string }>
  /** Marcadores usados por cenários "dispara uma vez" (ex.: timeout, troca de preço). */
  flags: Record<string, boolean>
  /** Último evento nft.updated emitido por NFT (para cenários de duplicata/evento antigo). */
  eventLog: Array<{ eventId: string; nftId: string; version: number; payload: unknown; occurredAt: string }>
}

let state: DbState | null = null

export function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
}
export const nowIso = () => new Date().toISOString()

async function seed(): Promise<DbState> {
  const users: DbUser[] = []
  for (const u of SEED_USERS) {
    const salt = `salt-${u.id}`
    users.push({
      id: u.id,
      username: u.username,
      email: u.email,
      displayName: u.displayName,
      avatarUrl: null,
      ensName: u.ensName,
      walletNickname: u.walletNickname,
      passwordSalt: salt,
      passwordHash: await hashPassword(u.password, salt),
    })
  }
  const ts = '2026-10-01T10:00:00.000Z'
  return {
    schemaVersion: SCHEMA_VERSION,
    nfts: buildNfts(),
    users,
    sessions: [],
    carts: [],
    favorites: { usr_ana: ['neon-vessel-552'], usr_bruno: [] },
    wallets: [
      {
        id: 'wal_ana_primary',
        userId: 'usr_ana',
        role: 'primary',
        displayName: 'Ana Ribeiro',
        nickname: 'Cofre principal',
        network: 'ethereum',
        address: '0xA91F3c2B7d4E5f60718293a4B5c6D7e8F9012E82',
        secondaryAddress: null,
        provider: 'metamask',
        profileName: 'anaribeiro',
        referralCode: 'KURIOANA',
        email: 'ana@kurio.dev',
        ensName: 'anaribeiro',
        updatedAt: ts,
      },
      {
        id: 'wal_bruno_primary',
        userId: 'usr_bruno',
        role: 'primary',
        displayName: 'Bruno Tavares',
        nickname: 'Carteira quente',
        network: 'polygon',
        address: '0x5b2C9e8D7a6F4e3B2c1D0e9F8a7B6c5D4e3F2a1B',
        secondaryAddress: null,
        provider: 'coinbase',
        profileName: 'brunot',
        referralCode: 'BRUNO01',
        email: 'bruno@kurio.dev',
        ensName: 'brunot',
        updatedAt: ts,
      },
    ],
    walletSessions: [],
    quotes: [],
    orders: [],
    idempotency: {},
    flags: {},
    eventLog: [],
  }
}

export async function initDb(opts: { reset?: boolean } = {}) {
  if (!opts.reset) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as DbState
        if (parsed.schemaVersion === SCHEMA_VERSION) {
          state = parsed
          return state
        }
      }
    } catch {
      /* dados corrompidos: reseed */
    }
  }
  state = await seed()
  save()
  return state
}

export async function resetDb() {
  return initDb({ reset: true })
}

export function db(): DbState {
  if (!state) throw new Error('Mock DB não inicializado')
  return state
}

export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota: segue em memória */
  }
}

/* ------------------------------------------------------------------ */
/* Projeções                                                          */
/* ------------------------------------------------------------------ */

export function publicUser(u: DbUser): User {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    ensName: u.ensName,
    walletNickname: u.walletNickname,
  }
}

export function findNft(id: string) {
  return db().nfts.find((n) => n.id === id)
}

export function toSummary(n: SeedNft) {
  return {
    id: n.id,
    tokenId: n.tokenId,
    name: n.name,
    image: n.image,
    imageAlt: n.imageAlt,
    price: n.price,
    compareAtPrice: n.compareAtPrice,
    rarity: n.rarity,
    category: n.category,
    network: n.network,
    soldOut: n.soldOut,
    version: n.version,
  }
}

export function toNft(n: SeedNft) {
  // remove campos internos (trendingScore, isNew)
  const { trendingScore: _t, isNew: _n, ...rest } = n
  return rest
}

/* ------------------------------------------------------------------ */
/* Carrinho e cotação                                                 */
/* ------------------------------------------------------------------ */

export function findCoupon(code: string | null) {
  if (!code) return null
  return COUPONS.find((c) => c.code === code.trim().toUpperCase()) ?? null
}

export function couponState(code: string | null): 'none' | 'valid' | 'invalid' | 'expired' {
  if (!code) return 'none'
  const c = findCoupon(code)
  if (!c) return 'invalid'
  if (new Date(c.expiresAt).getTime() < Date.now()) return 'expired'
  return 'valid'
}

function summarize(subtotal: string, couponCode: string | null, network: Network): Summary {
  const valid = couponState(couponCode) === 'valid'
  const coupon = valid ? findCoupon(couponCode)! : null
  const discount = coupon ? eth.pct(subtotal, coupon.percent).toDecimalPlaces(6) : eth.add('0')
  const fee = eth.cmp(subtotal, '0') > 0 ? NETWORK_FEES[network] : '0'
  const total = eth.add(eth.sub(subtotal, discount), fee)
  return {
    subtotal: eth.toWire(subtotal),
    discount: eth.toWire(discount),
    networkFee: eth.toWire(fee),
    total: eth.toWire(total),
    coupon: coupon ? { code: coupon.code, description: coupon.description } : null,
  }
}

export function projectCart(cart: DbCart, network: Network = 'ethereum'): Cart {
  const items: CartItem[] = []
  for (const it of cart.items) {
    const nft = findNft(it.nftId)
    const edition = nft?.editions.find((e) => e.id === it.editionId)
    if (!nft || !edition) continue
    const issues: CartIssue[] = []
    if (!eth.eq(edition.price, it.acknowledgedUnitPrice)) issues.push('PRICE_CHANGED')
    if (edition.available === 0) issues.push('SOLD_OUT')
    else if (it.quantity > edition.available) issues.push('INSUFFICIENT_AVAILABILITY')
    items.push({
      id: it.id,
      nftId: nft.id,
      editionId: edition.id,
      editionLabel: edition.label,
      name: nft.name,
      tokenId: nft.tokenId,
      image: nft.image,
      quantity: it.quantity,
      unitPrice: edition.price,
      acknowledgedUnitPrice: it.acknowledgedUnitPrice,
      lineTotal: eth.toWire(eth.mul(edition.price, it.quantity)),
      available: edition.available,
      maxPerOrder: edition.maxPerOrder,
      issues,
    })
  }
  const subtotal = eth.toWire(eth.add('0', ...items.map((i) => i.lineTotal)))
  return {
    id: cart.id,
    owner: cart.userId ? 'user' : 'guest',
    items,
    itemCount: items.reduce((a, i) => a + i.quantity, 0),
    summary: summarize(subtotal, cart.couponCode, network),
    updatedAt: cart.updatedAt,
  }
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function buildQuote(cart: DbCart, network: Network, userId: string) {
  const projected = projectCart(cart, network)
  const lines: QuoteLine[] = projected.items.map((i) => ({
    nftId: i.nftId,
    editionId: i.editionId,
    editionLabel: i.editionLabel,
    name: i.name,
    tokenId: i.tokenId,
    image: i.image,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    lineTotal: i.lineTotal,
  }))
  const issues = projected.items.flatMap((i) =>
    i.issues.filter((x) => x !== 'PRICE_CHANGED').map((issue) => ({ nftId: i.nftId, editionId: i.editionId, issue })),
  )
  const s = projected.summary
  const fingerprint = (
    await sha256(
      JSON.stringify({
        lines: lines.map((l) => [l.nftId, l.editionId, l.quantity, l.unitPrice]),
        s,
        network,
      }),
    )
  ).slice(0, 24)
  const quote: Quote & { userId: string; cartId: string } = {
    id: uid('qte'),
    fingerprint,
    network,
    lines,
    issues,
    ...s,
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    userId,
    cartId: cart.id,
  }
  db().quotes = [
    ...db()
      .quotes.filter((q) => q.userId !== userId)
      .slice(-20),
    quote,
  ]
  save()
  return quote
}

export function publicQuote(q: Quote & { userId?: string; cartId?: string }): Quote {
  const { userId: _u, cartId: _c, ...rest } = q
  return rest
}

export function publicOrder(o: DbOrder): Order {
  const { processAt: _p, cartId: _c, ...rest } = o
  return rest
}

export function cartOfUser(userId: string) {
  let cart = db().carts.find((c) => c.userId === userId)
  if (!cart) {
    cart = { id: uid('crt'), userId, items: [], couponCode: null, updatedAt: nowIso() }
    db().carts.push(cart)
    save()
  }
  return cart
}

export function guestCart(id: string) {
  let cart = db().carts.find((c) => c.id === id && c.userId === null)
  if (!cart) {
    cart = { id, userId: null, items: [], couponCode: null, updatedAt: nowIso() }
    db().carts.push(cart)
    save()
  }
  return cart
}
