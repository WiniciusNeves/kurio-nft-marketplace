import { useEffect, useId, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react'
import {
  CATEGORY_LABEL,
  SORT_LABEL,
  type CatalogResponse,
  type CatalogSort,
  type CatalogTab,
  type Category,
  type Network,
  type Rarity,
} from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/queryKeys'
import { Button } from '@/components/ui/button'
import { Dialog, DialogDescription, DialogTitle, DialogTrigger, SheetContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ErrorState'
import { cn } from '@/lib/utils'
import { NftCard, NftCardSkeleton } from './NftCard'
import { PAGE_SIZE, toCatalogQuery, type CatalogSearch } from './searchSchema'

export type SetSearch = (patch: Partial<CatalogSearch>, opts?: { resetPage?: boolean }) => void

const TABS: Array<{ value: CatalogTab; label: string }> = [
  { value: 'all', label: 'Todos os NFTs' },
  { value: 'new', label: 'Novos lançamentos' },
  { value: 'trending', label: 'Em alta' },
]

const rarityLabel: Array<{ value: Rarity; label: string }> = [
  { value: 'raro', label: 'Raro' },
  { value: 'lendario', label: 'Lendário' },
  { value: 'comum', label: 'Comum' },
]

export function useCatalog(search: CatalogSearch) {
  const query = toCatalogQuery(search)
  return useQuery({
    queryKey: qk.catalog(query),
    // O signal cancela a requisição quando a chave muda — respostas obsoletas são descartadas.
    queryFn: ({ signal }) => api.listNfts(query, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function CatalogSection({
  search,
  setSearch,
  aside,
}: {
  search: CatalogSearch
  setSearch: SetSearch
  aside?: React.ReactNode
}) {
  const catalog = useCatalog(search)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const resultsRef = useRef<HTMLDivElement>(null)
  const data = catalog.data
  const showSkeleton = catalog.isPending
  const updating = catalog.isFetching && !catalog.isPending
  const activeFilters =
    (search.category?.length ?? 0) +
    (search.network?.length ?? 0) +
    (search.minPrice || search.maxPrice ? 1 : 0) +
    (search.rarity ? 1 : 0)

  return (
    <section id="catalogo" aria-labelledby="catalogo-titulo" className="scroll-mt-6">
      <h2 id="catalogo-titulo" className="sr-only">
        Catálogo de NFTs
      </h2>

      {/* Barra de busca mobile (Figma: Mobile / Início) */}
      <div className="mb-4 flex gap-3 md:hidden">
        <SearchBox search={search} setSearch={setSearch} />
        <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DialogTrigger asChild>
            <Button
              variant="default"
              size="icon"
              className="size-[45px] shrink-0 rounded-xl"
              aria-label={`Filtros${activeFilters ? ` (${activeFilters} ativos)` : ''}`}
            >
              <SlidersHorizontal className="size-5" aria-hidden />
            </Button>
          </DialogTrigger>
          <SheetContent side="right">
            <DialogTitle className="text-lg font-bold">Filtros</DialogTitle>
            <DialogDescription className="mb-4 text-sm text-muted">
              Os resultados são atualizados ao selecionar.
            </DialogDescription>
            <div className="mb-6">
              <SortSelect
                value={search.sort ?? 'recent'}
                onChange={(sort) => setSearch({ sort: sort === 'recent' ? undefined : sort }, { resetPage: true })}
              />
            </div>
            <Filters data={data} search={search} setSearch={setSearch} embedded />
            <Button className="mt-6" onClick={() => setFiltersOpen(false)}>
              Ver {data?.total ?? ''} resultados
            </Button>
          </SheetContent>
        </Dialog>
      </div>

      <div className="grid gap-8 md:grid-cols-[220px_1fr] lg:grid-cols-[310px_1fr] lg:gap-[50px]">
        <div className="hidden md:block">
          <Filters data={data} search={search} setSearch={setSearch} />
          {aside}
        </div>

        <div ref={resultsRef} className="min-w-0">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div
              role="tablist"
              aria-label="Seleção do catálogo"
              className="flex shrink-0 gap-5 overflow-x-auto md:gap-4"
            >
              {TABS.map((t) => {
                const active = (search.tab ?? 'all') === t.value
                return (
                  <button
                    key={t.value}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    onClick={() => setSearch({ tab: t.value === 'all' ? undefined : t.value }, { resetPage: true })}
                    className={cn(
                      'shrink-0 border-b-2 pb-1 text-sm md:text-[13px]',
                      active ? 'border-primary font-bold text-primary-strong' : 'border-transparent text-foreground',
                    )}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
            <div className="hidden items-center gap-3 md:flex">
              <SortSelect
                value={search.sort ?? 'recent'}
                onChange={(sort) => setSearch({ sort: sort === 'recent' ? undefined : sort }, { resetPage: true })}
              />
            </div>
          </div>

          <div
            className="mt-2 flex min-h-6 items-center justify-between text-xs text-muted"
            aria-live="polite"
            role="status"
          >
            {data && !showSkeleton && (
              <span data-testid="catalog-total">
                {data.total} {data.total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}
                {search.q ? ` para “${search.q}”` : ''}
              </span>
            )}
            {updating && <span>Atualizando…</span>}
          </div>

          {catalog.isError && !data ? (
            <ErrorState
              error={catalog.error}
              title="Não foi possível carregar o catálogo"
              onRetry={() => catalog.refetch()}
              retrying={catalog.isFetching}
            />
          ) : (
            <>
              {catalog.isError && data && (
                <div
                  role="alert"
                  className="mb-3 flex items-center justify-between gap-3 border border-line bg-surface px-4 py-2 text-sm"
                >
                  <span>Falha ao atualizar. Mostrando os últimos resultados.</span>
                  <Button size="sm" variant="outline" onClick={() => catalog.refetch()}>
                    Tentar novamente
                  </Button>
                </div>
              )}
              <ul
                aria-busy={showSkeleton || updating}
                className={cn(
                  'mt-4 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-3 lg:gap-x-[34px] lg:gap-y-[64px]',
                  updating && 'opacity-70 transition-opacity',
                )}
                data-testid="catalog-grid"
              >
                {showSkeleton
                  ? Array.from({ length: PAGE_SIZE }, (_, i) => (
                      <li key={i} className={cn(i % 2 === 1 && 'mt-8 md:mt-0')}>
                        <NftCardSkeleton />
                      </li>
                    ))
                  : data?.items.map((nft, i) => (
                      <li key={nft.id} className={cn(i % 2 === 1 && 'mt-8 md:mt-0')}>
                        <NftCard nft={nft} priority={i < 3} />
                      </li>
                    ))}
              </ul>
              {data && data.items.length === 0 && !showSkeleton && (
                <div
                  className="mt-6 flex flex-col items-center gap-3 border border-line bg-surface px-6 py-12 text-center"
                  data-testid="catalog-empty"
                >
                  <p className="text-lg font-bold">Nenhum NFT encontrado</p>
                  <p className="max-w-sm text-sm text-muted">Ajuste a busca ou os filtros para ver mais resultados.</p>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setSearch(
                        {
                          q: undefined,
                          category: undefined,
                          network: undefined,
                          minPrice: undefined,
                          maxPrice: undefined,
                          rarity: undefined,
                          tab: undefined,
                        },
                        { resetPage: true },
                      )
                    }
                  >
                    Limpar filtros
                  </Button>
                </div>
              )}
              {data && data.totalPages > 1 && (
                <Pagination
                  page={data.page}
                  totalPages={data.totalPages}
                  onChange={(page) => {
                    setSearch({ page: page === 1 ? undefined : page })
                    resultsRef.current?.scrollIntoView({ block: 'start' })
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function SearchBox({ search, setSearch, compact }: { search: CatalogSearch; setSearch: SetSearch; compact?: boolean }) {
  const id = useId()
  const [value, setValue] = useState(search.q ?? '')
  useEffect(() => setValue(search.q ?? ''), [search.q])
  // Debounce: cada tecla não vira uma requisição; o histórico recebe só o termo final.
  useEffect(() => {
    const term = value.trim()
    if (term === (search.q ?? '')) return
    const t = setTimeout(() => setSearch({ q: term || undefined }, { resetPage: true }), 350)
    return () => clearTimeout(t)
  }, [value, search.q, setSearch])

  return (
    <form
      role="search"
      className="relative flex-1"
      onSubmit={(e) => {
        e.preventDefault()
        setSearch({ q: value.trim() || undefined }, { resetPage: true })
      }}
    >
      <label htmlFor={id} className="sr-only">
        Buscar no catálogo
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <Input
        id={id}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={compact ? 'Buscar…' : 'Explorar coleções'}
        className={cn('pl-11', compact ? 'h-9 w-48' : 'h-[45px] rounded-xl border-0 bg-surface')}
        data-testid="catalog-search"
      />
    </form>
  )
}

function SortSelect({ value, onChange }: { value: CatalogSort; onChange: (v: CatalogSort) => void }) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="shrink-0 text-sm md:text-[15px]">
        Ordenar por:
      </label>
      <Select value={value} onValueChange={(v) => onChange(v as CatalogSort)}>
        <SelectTrigger
          id={id}
          className="h-9 w-auto gap-1 border-0 bg-transparent px-1 text-sm whitespace-nowrap md:text-[15px]"
          data-testid="sort-select"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SORT_LABEL) as CatalogSort[]).map((s) => (
            <SelectItem key={s} value={s}>
              {SORT_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function Filters({
  data,
  search,
  setSearch,
  embedded,
}: {
  data: CatalogResponse | undefined
  search: CatalogSearch
  setSearch: SetSearch
  embedded?: boolean
}) {
  const facets = data?.facets
  const min = Number(facets?.priceRange.min ?? 0)
  const max = Number(facets?.priceRange.max ?? 0)
  const [range, setRange] = useState<[number, number] | null>(null)
  const current: [number, number] = range ?? [
    search.minPrice ? Number(search.minPrice) : min,
    search.maxPrice ? Number(search.maxPrice) : max,
  ]

  const toggle = <T extends string>(list: T[] | undefined, v: T) => {
    const s = new Set(list ?? [])
    if (s.has(v)) s.delete(v)
    else s.add(v)
    return s.size ? ([...s] as T[]) : undefined
  }

  return (
    <div className={cn(!embedded && 'bg-surface px-5 py-6')} data-testid="filters">
      <fieldset>
        <legend className="mb-3 text-lg font-bold">Coleções</legend>
        <ul className="flex flex-col">
          {facets
            ? facets.categories.map((c) => {
                const active = search.category?.includes(c.value as Category) ?? false
                return (
                  <li key={c.value}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setSearch({ category: toggle(search.category, c.value as Category) }, { resetPage: true })
                      }
                      className={cn(
                        'flex w-full items-center justify-between rounded-sm px-3 py-2.5 text-left text-[15px]',
                        active ? 'bg-surface-2 font-bold text-primary-strong' : 'text-muted hover:text-primary-strong',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {active && <span aria-hidden>✓</span>}
                        {CATEGORY_LABEL[c.value as Category]}
                      </span>
                      <span className="tabular-nums">({c.count})</span>
                    </button>
                  </li>
                )
              })
            : Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="my-2 h-6" />)}
        </ul>
      </fieldset>

      <fieldset className="mt-8">
        <legend className="mb-3 text-lg font-bold">Faixa de preço</legend>
        {facets && max > 0 ? (
          <div className="px-3">
            <Slider
              min={min}
              max={max}
              step={0.01}
              value={current}
              minStepsBetweenThumbs={1}
              onValueChange={(v) => setRange([v[0], v[1]])}
              thumbLabels={['Preço mínimo', 'Preço máximo']}
            />
            <p className="mt-4 text-[15px]" aria-live="polite">
              Preço: {current[0].toFixed(2).replace('.', ',')} - {current[1].toFixed(2).replace('.', ',')} ETH
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  const [a, b] = current
                  setSearch(
                    {
                      minPrice: a > min ? a.toFixed(2) : undefined,
                      maxPrice: b < max ? b.toFixed(2) : undefined,
                    },
                    { resetPage: true },
                  )
                  setRange(null)
                }}
              >
                Aplicar
              </Button>
              {(search.minPrice || search.maxPrice) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setRange(null)
                    setSearch({ minPrice: undefined, maxPrice: undefined }, { resetPage: true })
                  }}
                >
                  Limpar
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Skeleton className="h-16" />
        )}
      </fieldset>

      <fieldset className="mt-8">
        <legend className="mb-3 text-lg font-bold">Rede</legend>
        <ul className="flex flex-col">
          {facets?.networks.map((n) => {
            const active = search.network?.includes(n.value as Network) ?? false
            return (
              <li key={n.value}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setSearch({ network: toggle(search.network, n.value as Network) }, { resetPage: true })
                  }
                  className={cn(
                    'flex w-full items-center justify-between rounded-sm px-3 py-2.5 text-left text-[15px]',
                    active ? 'bg-surface-2 font-bold text-primary-strong' : 'text-muted hover:text-primary-strong',
                  )}
                >
                  <span className="flex items-center gap-2">
                    {active && <span aria-hidden>✓</span>}
                    {n.label}
                  </span>
                  <span className="tabular-nums">({n.count})</span>
                </button>
              </li>
            )
          })}
        </ul>
      </fieldset>

      <fieldset className="mt-8">
        <legend className="mb-3 text-lg font-bold">Raridade</legend>
        <ul className="flex flex-col">
          {rarityLabel.map((r) => {
            const active = search.rarity === r.value
            return (
              <li key={r.value}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSearch({ rarity: active ? undefined : r.value }, { resetPage: true })}
                  className={cn(
                    'flex w-full items-center justify-between rounded-sm px-3 py-2.5 text-left text-[15px]',
                    active ? 'bg-surface-2 font-bold text-primary-strong' : 'text-muted hover:text-primary-strong',
                  )}
                >
                  <span className="flex items-center gap-2">
                    {active && <span aria-hidden>✓</span>}
                    {r.label}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </fieldset>
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
}) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
  )
  return (
    <nav aria-label="Paginação" className="mt-12 flex justify-end">
      <ul className="flex items-center gap-2">
        <li>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-sm border border-line disabled:opacity-40"
            onClick={() => onChange(page - 1)}
            disabled={page <= 1}
            aria-label="Página anterior"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
        </li>
        {pages.map((p, i) => (
          <li key={p} className="flex items-center gap-2">
            {i > 0 && p - pages[i - 1] > 1 && <span aria-hidden>…</span>}
            <button
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Página ${p}`}
              className={cn(
                'grid size-8 place-items-center rounded-sm border text-sm',
                p === page ? 'border-primary bg-primary font-bold text-primary-foreground' : 'border-line',
              )}
            >
              {p}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-sm border border-line disabled:opacity-40"
            onClick={() => onChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Próxima página"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </li>
      </ul>
    </nav>
  )
}
