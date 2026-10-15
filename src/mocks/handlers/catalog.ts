import { HttpResponse, http } from 'msw'
import {
  CATEGORY_LABEL,
  NETWORK_LABEL,
  categorySchema,
  networkSchema,
  sortSchema,
  tabSchema,
  type CatalogResponse,
  type Category,
  type Network,
} from '@/api/contracts'
import { eth } from '@/lib/eth'
import { getConfig } from '../config'
import { db, findNft, toNft, toSummary } from '../db'
import { api, applyNetwork, errorResponse } from '../http'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const catalogHandlers = [
  http.get(api('/nfts'), async ({ request }) => {
    const fail = await applyNetwork(request, 'catalog')
    if (fail) return fail

    const url = new URL(request.url)
    const p = url.searchParams
    const q = norm(p.get('q') ?? '').trim()
    const categories = p.getAll('category').filter((c) => categorySchema.safeParse(c).success) as Category[]
    const networks = p.getAll('network').filter((n) => networkSchema.safeParse(n).success) as Network[]
    const minPrice = p.get('minPrice')
    const maxPrice = p.get('maxPrice')
    const sort = sortSchema.catch('recent').parse(p.get('sort') ?? 'recent')
    const tab = tabSchema.catch('all').parse(p.get('tab') ?? 'all')
    const page = Math.max(1, Number(p.get('page')) || 1)
    const pageSize = Math.min(48, Math.max(1, Number(p.get('pageSize')) || 9))

    if (minPrice && maxPrice && eth.cmp(minPrice, maxPrice) > 0) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Faixa de preço inválida.', {
        fieldErrors: { minPrice: 'O mínimo deve ser menor que o máximo' },
      })
    }

    const all = getConfig().scenario === 'empty' ? [] : db().nfts

    // Base para facets: busca + aba (contagens não se anulam ao filtrar a própria facet).
    const base = all.filter((n) => {
      if (q && !norm(`${n.name} ${n.collectionName} ${n.creator}`).includes(q)) return false
      if (tab === 'new' && !n.isNew) return false
      if (tab === 'trending' && n.trendingScore < 50) return false
      return true
    })

    const filtered = base.filter((n) => {
      if (categories.length && !categories.includes(n.category)) return false
      if (networks.length && !networks.includes(n.network)) return false
      if (minPrice && eth.cmp(n.price, minPrice) < 0) return false
      if (maxPrice && eth.cmp(n.price, maxPrice) > 0) return false
      return true
    })

    const sorted = [...filtered].sort((a, b) => {
      switch (sort) {
        case 'price-asc':
          return eth.cmp(a.price, b.price) || a.name.localeCompare(b.name)
        case 'price-desc':
          return eth.cmp(b.price, a.price) || a.name.localeCompare(b.name)
        case 'name':
          return a.name.localeCompare(b.name, 'pt-BR')
        default:
          return tab === 'trending'
            ? b.trendingScore - a.trendingScore
            : Date.parse(b.listedAt) - Date.parse(a.listedAt)
      }
    })

    const total = sorted.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const items = sorted.slice((page - 1) * pageSize, page * pageSize).map(toSummary)

    const prices = all.map((n) => n.price)
    const body: CatalogResponse = {
      items,
      page,
      pageSize,
      total,
      totalPages,
      facets: {
        categories: (Object.keys(CATEGORY_LABEL) as Category[]).map((c) => ({
          value: c,
          label: CATEGORY_LABEL[c],
          count: base.filter((n) => n.category === c).length,
        })),
        networks: (Object.keys(NETWORK_LABEL) as Network[]).map((n) => ({
          value: n,
          label: NETWORK_LABEL[n],
          count: base.filter((x) => x.network === n).length,
        })),
        priceRange: {
          min: prices.length ? prices.reduce((a, b) => (eth.cmp(a, b) < 0 ? a : b)) : '0',
          max: prices.length ? prices.reduce((a, b) => (eth.cmp(a, b) > 0 ? a : b)) : '0',
        },
      },
    }
    return HttpResponse.json(body)
  }),

  http.get(api('/nfts/:id'), async ({ request, params }) => {
    const fail = await applyNetwork(request, 'detail')
    if (fail) return fail
    const nft = findNft(String(params.id))
    if (!nft || getConfig().scenario === 'empty') {
      return errorResponse(404, 'NOT_FOUND', 'NFT não encontrado.')
    }
    return HttpResponse.json(toNft(nft))
  }),

  http.get(api('/nfts/:id/related'), async ({ request, params }) => {
    const fail = await applyNetwork(request, 'public')
    if (fail) return fail
    const nft = findNft(String(params.id))
    if (!nft) return errorResponse(404, 'NOT_FOUND', 'NFT não encontrado.')
    const related = db()
      .nfts.filter((n) => n.id !== nft.id && n.collectionName === nft.collectionName)
      .slice(0, 10)
      .map(toSummary)
    return HttpResponse.json({ items: related })
  }),
]
