/**
 * Fixtures determinísticas (mesma semente => mesmos dados em dev, demo e testes).
 */
import type { Category, Edition, Network, Nft } from '@/api/contracts'
import { CATEGORY_LABEL } from '@/api/contracts'
import { eth } from '@/lib/eth'

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const IMAGES = {
  ape: {
    src: '/nfts/emerald-ape.webp',
    alt: 'Macaco de pelo castanho com óculos redondos verdes e jaqueta college verde',
  },
  gorilla: { src: '/nfts/violet-nomad.webp', alt: 'Gorila grisalho com chapéu bucket verde-oliva e moletom roxo' },
  golden: { src: '/nfts/golden-beat.webp', alt: 'Macaco dourado com fones de ouvido verdes e jaqueta creme' },
  dark: { src: '/nfts/ivory-baron.webp', alt: 'Gorila de pelo escuro com gola alta verde e blazer creme' },
} as const
type ImageKey = keyof typeof IMAGES

/** Os 9 primeiros reproduzem os cards do Figma. */
const FEATURED: Array<{
  name: string
  token: string
  price: string
  compareAt?: string
  rarity?: 'raro'
  img: ImageKey
  category: Category
  network: Network
}> = [
  { name: 'Emerald Ape', token: '042', price: '1.19', img: 'ape', category: 'arte-digital', network: 'ethereum' },
  { name: 'Sage Nomad', token: '009', price: '1.69', img: 'gorilla', category: 'arte-digital', network: 'ethereum' },
  {
    name: 'Neon Vessel',
    token: '552',
    price: '1.99',
    compareAt: '2.29',
    rarity: 'raro',
    img: 'dark',
    category: 'colecionaveis',
    network: 'ethereum',
  },
  { name: 'Cosmic Bloom', token: '118', price: '1.29', img: 'gorilla', category: 'generativa', network: 'polygon' },
  { name: 'Violet Nomad', token: '314', price: '1.39', img: 'gorilla', category: 'arte-digital', network: 'ethereum' },
  { name: 'Ivory Baron', token: '088', price: '1.79', img: 'dark', category: 'fotografia', network: 'ethereum' },
  { name: 'Golden Beat', token: '207', price: '0.99', img: 'golden', category: 'musica', network: 'solana' },
  { name: 'Golden Frequency', token: '071', price: '0.59', img: 'golden', category: 'musica', network: 'polygon' },
  { name: 'Golden Signal', token: '160', price: '0.39', img: 'golden', category: 'musica', network: 'solana' },
]

const PREFIX = [
  'Amber',
  'Onyx',
  'Copper',
  'Velvet',
  'Crimson',
  'Lunar',
  'Rust',
  'Jade',
  'Saffron',
  'Cobalt',
  'Ochre',
  'Umber',
]
const SUFFIX = ['Monarch', 'Echo', 'Drift', 'Pulse', 'Totem', 'Relic', 'Cipher', 'Rhythm', 'Wanderer', 'Oracle']
const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[]
const NETWORKS: Network[] = ['ethereum', 'polygon', 'solana']
const IMG_KEYS = Object.keys(IMAGES) as ImageKey[]

function buildEditions(base: string, idx: number): Edition[] {
  const soldOutUnique = idx % 3 === 2
  return [
    {
      id: '1-1',
      label: '1/1',
      supply: 1,
      available: soldOutUnique ? 0 : 1,
      maxPerOrder: 1,
      price: eth.toWire(eth.mul(base, 4)),
    },
    {
      id: '1-10',
      label: '1/10',
      supply: 10,
      available: idx % 5 === 4 ? 0 : 10 - (idx % 4),
      maxPerOrder: 5,
      price: eth.toWire(eth.mul(base, '1.5')),
    },
    { id: '1-50', label: '1/50', supply: 50, available: 50 - (idx % 7) * 3, maxPerOrder: 10, price: base },
    {
      id: 'open',
      label: 'ABERTA',
      supply: null,
      available: 999,
      maxPerOrder: 20,
      price: eth.toWire(eth.mul(base, '0.6')),
    },
  ]
}

function buildNft(
  i: number,
  data: {
    name: string
    token: string
    price: string
    compareAt?: string
    rarity?: 'raro' | 'lendario'
    img: ImageKey
    category: Category
    network: Network
  },
  listedAt: Date,
  trending: number,
): Nft & { trendingScore: number; isNew: boolean } {
  const id = `${data.name.toLowerCase().replace(/\s+/g, '-')}-${data.token}`
  const image = IMAGES[data.img]
  const editions = buildEditions(data.price, i)
  const title = `${data.name} #${data.token}`
  return {
    id,
    tokenId: `#0${data.token}`,
    name: title,
    image: image.src,
    imageAlt: `${title}: ${image.alt}`,
    price: data.price,
    compareAtPrice: data.compareAt ?? null,
    rarity: data.rarity ?? null,
    category: data.category,
    network: data.network,
    soldOut: editions.every((e) => e.available === 0),
    version: 1,
    collectionName: data.img === 'ape' ? 'Kurio Apes' : 'Kurio Editions',
    creator: ['Nova Sato', 'Iara Mendes', 'Theo Kuroda', 'Lia Okafor'][i % 4],
    description:
      'Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.',
    longDescription: [
      `${title} é uma obra digital 1/50 finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na rede. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
      'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. O criador recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.',
    ],
    attributes: [
      ['Óculos', 'Esmeralda', 'Raro'],
      ['Chapéu', 'Moletom', 'Calmo'],
      ['Gola alta', 'Brinco', 'Noturno'],
      ['Fones', 'Dourado', 'Ritmo'],
    ][IMG_KEYS.indexOf(data.img)],
    gallery: [image.src, image.src, image.src, image.src],
    rating: 4 + ((i * 7) % 10) / 10,
    reviewsCount: 5 + ((i * 13) % 40),
    editions,
    contractAddress: `0x7A42${((i * 2654435761) >>> 0).toString(16).padStart(8, '0').toUpperCase()}19E8`,
    royaltiesPct: 5,
    listedAt: listedAt.toISOString(),
    trendingScore: trending,
    isNew: i % 4 === 0,
  }
}

export type SeedNft = ReturnType<typeof buildNft>

export function buildNfts(): SeedNft[] {
  const rand = mulberry32(20260729)
  const base = new Date('2026-09-30T12:00:00.000Z').getTime()
  const out: SeedNft[] = []
  FEATURED.forEach((f, i) => {
    out.push(buildNft(i, f, new Date(base - i * 3_600_000), Math.round(rand() * 100)))
  })
  for (let i = FEATURED.length; i < 60; i++) {
    const name = `${PREFIX[i % PREFIX.length]} ${SUFFIX[(i * 7) % SUFFIX.length]}`
    const token = String(100 + ((i * 37) % 900)).padStart(3, '0')
    const priceNum = 0.02 + Math.floor(rand() * 1228) / 100 // 0.02 .. 12.30
    const price = priceNum.toFixed(2)
    out.push(
      buildNft(
        i,
        {
          name,
          token,
          price,
          compareAt: i % 11 === 0 ? (priceNum * 1.15).toFixed(2) : undefined,
          rarity: i % 9 === 0 ? 'raro' : undefined,
          img: IMG_KEYS[i % IMG_KEYS.length],
          category: CATEGORIES[(i * 5) % CATEGORIES.length],
          network: NETWORKS[(i * 2) % NETWORKS.length],
        },
        new Date(base - i * 3_600_000 * 5),
        Math.round(rand() * 100),
      ),
    )
  }
  return out
}

export const COUPONS = [
  { code: 'KURIO10', description: '10% de desconto de lançamento', percent: 10, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'LANCAMENTO5', description: '5% no lançamento Kurio', percent: 5, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'VERAO2025', description: 'Campanha de verão 2025', percent: 15, expiresAt: '2025-03-20T23:59:59.000Z' },
]

export const NETWORK_FEES: Record<Network, string> = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.0005',
}

/** Credenciais fictícias — documentadas no README. */
export const SEED_USERS = [
  {
    id: 'usr_ana',
    username: 'ana.coleciona',
    email: 'ana@kurio.dev',
    password: 'Kurio2026',
    displayName: 'Ana Ribeiro',
    ensName: 'anaribeiro',
    walletNickname: 'Cofre principal',
  },
  {
    id: 'usr_bruno',
    username: 'bruno_nft',
    email: 'bruno@kurio.dev',
    password: 'Kurio2026',
    displayName: 'Bruno Tavares',
    ensName: 'brunot',
    walletNickname: 'Carteira quente',
  },
]
