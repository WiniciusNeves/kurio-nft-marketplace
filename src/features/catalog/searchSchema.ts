import { z } from 'zod'
import { categorySchema, ethSchema, networkSchema, sortSchema, tabSchema, type CatalogQuery } from '@/api/contracts'

/**
 * Estado do catálogo na URL (sobrevive a refresh e navegação pelo histórico).
 * Valores inválidos são descartados em vez de quebrar a página.
 */
export const catalogSearchSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  category: z.array(categorySchema).optional().catch(undefined),
  network: z.array(networkSchema).optional().catch(undefined),
  minPrice: ethSchema.optional().catch(undefined),
  maxPrice: ethSchema.optional().catch(undefined),
  sort: sortSchema.optional().catch(undefined),
  tab: tabSchema.optional().catch(undefined),
  page: z.number().int().min(1).max(999).optional().catch(undefined),
  rarity: z.enum(['raro', 'lendario', 'comum']).optional().catch(undefined),
})
export type CatalogSearch = z.infer<typeof catalogSearchSchema>

export const PAGE_SIZE = 9

export function toCatalogQuery(s: CatalogSearch): CatalogQuery {
  return {
    q: s.q || undefined,
    categories: s.category?.length ? [...s.category].sort() : undefined,
    networks: s.network?.length ? [...s.network].sort() : undefined,
    minPrice: s.minPrice,
    maxPrice: s.maxPrice,
    sort: s.sort ?? 'recent',
    tab: s.tab ?? 'all',
    page: s.page ?? 1,
    pageSize: PAGE_SIZE,
    rarity: s.rarity,
  }
}
