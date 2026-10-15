import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { ChevronLeft, Heart, Mail, Minus, Plus, Search, ShoppingCart, Star } from 'lucide-react'
import { LinkedinIcon as Linkedin, TwitterIcon as Twitter } from '@/components/icons'
import { toast } from 'sonner'
import { NETWORK_LABEL, type Edition, type Nft } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { ApiError } from '@/api/errors'
import { qk } from '@/api/queryKeys'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { ErrorState } from '@/components/ErrorState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCurrentUser } from '@/features/auth/useSession'
import { useAddToCart } from '@/features/cart/useCart'
import { NftCard, NftCardSkeleton } from '@/features/catalog/NftCard'
import { useFavorites, useToggleFavorite } from '@/features/favorites/useFavorites'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { realtime } from '@/realtime/realtime'

export function NftDetailPage() {
  const { nftId } = useParams({ from: '/nft/$nftId' })
  const query = useQuery({
    queryKey: qk.nft(nftId),
    queryFn: ({ signal }) => api.getNft(nftId, { signal }),
  })

  // Feedback acessível de mudanças em tempo real neste NFT.
  useEffect(
    () =>
      realtime.onNftUpdated((e) => {
        if (e.payload.nftId !== nftId) return
        toast.info(
          e.payload.reason === 'availability'
            ? 'Disponibilidade deste NFT foi atualizada.'
            : `Preço atualizado: ${formatEth(e.payload.price)}`,
        )
      }),
    [nftId],
  )

  if (query.isPending) return <DetailSkeleton />
  if (query.isError) {
    const e = query.error
    if (e instanceof ApiError && e.status === 404) return <NftNotFound />
    return (
      <div className="container-page py-10">
        <ErrorState
          error={e}
          title="Não foi possível carregar este NFT"
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
        />
      </div>
    )
  }
  return <NftDetail nft={query.data} />
}

function NftNotFound() {
  return (
    <div className="container-page flex flex-col items-center gap-4 py-24 text-center" data-testid="nft-not-found">
      <h1 className="text-2xl font-bold">NFT não encontrado</h1>
      <p className="max-w-md text-muted">O item que você procura não existe ou foi removido do mercado.</p>
      <Button asChild>
        <Link to="/mercado">Voltar ao mercado</Link>
      </Button>
    </div>
  )
}

function firstAvailable(nft: Nft) {
  return (
    nft.editions.find((e) => e.id === '1-50' && e.available > 0) ??
    nft.editions.find((e) => e.available > 0) ??
    nft.editions[0]
  )
}

function NftDetail({ nft }: { nft: Nft }) {
  const search = useSearch({ from: '/nft/$nftId' })
  const navigate = useNavigate({ from: '/nft/$nftId' })
  const { href } = useLocation()
  const user = useCurrentUser()
  const favorites = useFavorites()
  const toggleFav = useToggleFavorite()
  const add = useAddToCart()
  const [qty, setQty] = useState(1)
  const [zoom, setZoom] = useState(false)
  const [activeImage, setActiveImage] = useState(0)

  const edition: Edition = nft.editions.find((e) => e.id === search.edicao) ?? firstAvailable(nft)
  const limit = Math.max(0, Math.min(edition.maxPerOrder, edition.available))
  const unavailable = edition.available === 0
  const isFav = favorites.data?.nftIds.includes(nft.id) ?? false

  // Quantidade nunca excede o limite atual (inclusive após eventos em tempo real).
  useEffect(() => {
    setQty((q) => Math.max(1, Math.min(q, limit || 1)))
  }, [limit])

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const requireAuthFor = (action: string) => {
    toast.info(`Entre na sua conta para ${action}.`)
    void navigate({ to: '/login', search: { redirect: href } })
  }

  const buy = (goToCart: boolean) =>
    add.mutate(
      { nftId: nft.id, editionId: edition.id, quantity: qty },
      {
        onSuccess: () => {
          if (goToCart) void navigate({ to: '/cart' })
        },
        onError: (e) => toast.error(e.message),
      },
    )

  const favButton = (className?: string, iconOnly = false) => (
    <Button
      variant="outline"
      className={className}
      aria-pressed={isFav}
      aria-label={iconOnly ? (isFav ? 'Remover dos favoritos' : 'Favoritar') : undefined}
      onClick={() =>
        user ? toggleFav.mutate({ nftId: nft.id, favorite: !isFav, name: nft.name }) : requireAuthFor('favoritar')
      }
    >
      <Heart className={cn(isFav && 'fill-primary')} aria-hidden />
      {!iconOnly && (isFav ? 'Favoritado' : 'Favoritar')}
    </Button>
  )

  return (
    <div className="pb-44 md:pb-0">
      <div className="container-page hidden md:block">
        <Breadcrumbs
          items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/mercado' }, { label: nft.name }]}
        />
      </div>

      <div className="container-page grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[100px_395px_1fr] lg:gap-[30px]">
        {/* Galeria */}
        <ul className="order-2 hidden gap-3 lg:order-none lg:flex lg:flex-col" aria-label="Imagens do NFT">
          {nft.gallery.map((src, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => setActiveImage(i)}
                aria-label={`Ver imagem ${i + 1} de ${nft.gallery.length}`}
                aria-pressed={activeImage === i}
                className={cn(
                  'block overflow-hidden rounded-sm border-2',
                  activeImage === i ? 'border-primary' : 'border-transparent',
                )}
              >
                <img
                  src={src.replace('.webp', '-thumb.webp')}
                  alt=""
                  width={89}
                  height={89}
                  className="size-[89px] object-cover"
                />
              </button>
            </li>
          ))}
        </ul>

        <div className="relative -mx-4 md:mx-0">
          <div className="absolute inset-x-4 top-3 z-10 flex justify-between md:hidden">
            <button
              type="button"
              onClick={() => (history.length > 1 ? history.back() : void navigate({ to: '/mercado' }))}
              className="grid size-9 place-items-center rounded-full border border-line-soft bg-background/70 text-foreground"
              aria-label="Voltar"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            {favButton('size-9 rounded-full border-line-soft bg-background/70 p-0', true)}
          </div>
          <div className="bg-surface p-4 pt-14 md:p-5">
            <img
              src={nft.gallery[activeImage] ?? nft.image}
              alt={nft.imageAlt}
              width={404}
              height={404}
              fetchPriority="high"
              className={cn(
                'aspect-square w-full rounded-[16px] object-cover',
                unavailable && nft.soldOut && 'grayscale',
              )}
            />
          </div>
          <Dialog open={zoom} onOpenChange={setZoom}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="absolute top-16 right-6 hidden size-9 place-items-center rounded-full bg-background/80 md:top-3 md:right-3 md:grid"
                aria-label="Ampliar imagem"
              >
                <Search className="size-5" aria-hidden />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-[640px]">
              <DialogTitle className="mb-2 text-lg font-bold">{nft.name}</DialogTitle>
              <DialogDescription className="sr-only">Imagem ampliada</DialogDescription>
              <img src={nft.image} alt={nft.imageAlt} className="w-full rounded-[16px]" />
            </DialogContent>
          </Dialog>
        </div>

        <section
          aria-labelledby="nft-title"
          className="-mx-4 -mt-10 rounded-t-[28px] bg-surface px-6 pt-8 md:mx-0 md:mt-0 md:rounded-none md:bg-transparent md:p-0"
        >
          <div className="flex items-start justify-between gap-3">
            <h1 id="nft-title" className="text-xl font-bold md:text-[28px]" data-testid="nft-title">
              {nft.name}
            </h1>
            <span className="flex shrink-0 items-center gap-1 rounded-full border border-primary px-2 py-0.5 text-sm md:hidden">
              <Star className="size-4 fill-primary text-primary" aria-hidden />
              <span className="font-bold">{nft.rating.toFixed(1)}</span>
              <span className="text-muted">({nft.reviewsCount})</span>
              <span className="sr-only">avaliação média de {nft.reviewsCount} colecionadores</span>
            </span>
          </div>
          <div className="mt-2 hidden items-center justify-between gap-3 border-b border-line pb-3 md:flex">
            <p className="text-2xl font-bold text-primary-strong" data-testid="nft-price">
              {formatEth(edition.price)}
            </p>
            <p className="flex items-center gap-1 text-sm">
              <span className="flex" aria-hidden>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={cn('size-3.5', i < Math.round(nft.rating) ? 'fill-primary text-primary' : 'text-subtle')}
                  />
                ))}
              </span>
              <span>
                <span className="sr-only">Nota {nft.rating.toFixed(1)} de 5, </span>
                {nft.reviewsCount} avaliações de colecionadores
              </span>
            </p>
          </div>

          <h2 className="mt-4 hidden text-sm font-bold md:block">Sobre este NFT:</h2>
          <p className="mt-3 text-sm leading-6 text-muted">{nft.description}</p>

          <fieldset className="mt-4">
            <legend className="text-sm font-bold">Edição:</legend>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Edição">
              {nft.editions.map((e) => {
                const selected = e.id === edition.id
                const soldOut = e.available === 0
                return (
                  <button
                    key={e.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => navigate({ search: { edicao: e.id }, replace: true, resetScroll: false })}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs',
                      selected ? 'border-primary font-bold text-primary-strong' : 'border-line-soft text-muted',
                      soldOut && 'line-through opacity-60',
                    )}
                  >
                    {e.label}
                    {soldOut && <span className="sr-only"> (esgotada)</span>}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-muted" aria-live="polite" data-testid="edition-status">
              {unavailable
                ? `Edição ${edition.label} indisponível — escolha outra edição.`
                : `${edition.supply ? `${edition.available} de ${edition.supply} disponíveis` : 'Edição aberta'} · até ${edition.maxPerOrder} por pedido`}
            </p>
          </fieldset>

          <div className="mt-4 hidden flex-wrap items-center justify-between gap-4 md:flex">
            <QuantityStepper value={qty} max={limit} onChange={setQty} disabled={unavailable} />
            <div className="flex gap-2">
              <Button
                onClick={() => buy(true)}
                loading={add.isPending}
                disabled={unavailable}
                className="h-9 w-[116px] rounded-sm text-xs uppercase"
              >
                Comprar
              </Button>
              {favButton('h-9 rounded-sm text-sm')}
            </div>
          </div>

          <dl className="mt-5 space-y-3 text-sm text-muted">
            <div className="flex gap-1">
              <dt>ID do token:</dt>
              <dd>{nft.tokenId}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Coleção:</dt>
              <dd>{nft.collectionName}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Atributos:</dt>
              <dd>{nft.attributes.join(', ')}</dd>
            </div>
          </dl>
          <div className="mt-3 hidden items-center gap-3 text-sm font-bold md:flex">
            <span>Compartilhar este NFT:</span>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Compartilhar no LinkedIn (abre em nova aba)"
            >
              <Linkedin className="size-4" aria-hidden />
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent(nft.name)}&body=${encodeURIComponent(shareUrl)}`}
              aria-label="Compartilhar por e-mail"
            >
              <Mail className="size-4" aria-hidden />
            </a>
            <a
              href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(nft.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Compartilhar no Twitter (abre em nova aba)"
            >
              <Twitter className="size-4" aria-hidden />
            </a>
          </div>
        </section>
      </div>

      {/* Barra de compra mobile (Figma: Mobile / Detalhes do NFT › Buy Bar) */}
      <div className="fixed inset-x-0 bottom-0 z-30 rounded-t-[28px] border-t border-line bg-surface px-6 pt-5 pb-4 md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted" id="qty-label-m">
              Qtd.
            </span>
            <QuantityStepper value={qty} max={limit} onChange={setQty} disabled={unavailable} />
          </div>
          <p className="text-xl font-bold text-primary-strong">{formatEth(edition.price)}</p>
        </div>
        <div className="mt-4 flex gap-3">
          <Button
            onClick={() => buy(true)}
            loading={add.isPending}
            disabled={unavailable}
            className="h-14 flex-1 rounded-2xl cta-gradient text-base"
          >
            Comprar NFT
          </Button>
          <Button
            variant="subtle"
            className="size-14 rounded-full p-0"
            aria-label="Adicionar ao carrinho"
            disabled={unavailable || add.isPending}
            onClick={() => buy(false)}
          >
            <ShoppingCart aria-hidden />
          </Button>
        </div>
      </div>

      <div className="container-page mt-16">
        <Tabs defaultValue="detalhes">
          <TabsList>
            <TabsTrigger value="detalhes">Detalhes do NFT</TabsTrigger>
            <TabsTrigger value="avaliacoes">Avaliações de colecionadores ({nft.reviewsCount})</TabsTrigger>
          </TabsList>
          <TabsContent value="detalhes" className="mt-4 space-y-5 text-sm leading-6 text-muted">
            {nft.longDescription.map((p) => (
              <p key={p.slice(0, 20)}>{p}</p>
            ))}
            <div>
              <h3 className="font-bold text-foreground">Rede:</h3>
              <p>Cunhado na {NETWORK_LABEL[nft.network]} com procedência imutável e metadados armazenados no IPFS.</p>
            </div>
            <div>
              <h3 className="font-bold text-foreground">Contrato:</h3>
              <p>
                Direitos autorais do criador: {nft.royaltiesPct}% nas vendas secundárias, pagos automaticamente pelos
                mercados compatíveis.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-foreground">Direitos autorais:</h3>
              <p>
                {nft.contractAddress.slice(0, 6)}...{nft.contractAddress.slice(-4)} · Contrato inteligente ERC-721
                verificado.
              </p>
            </div>
          </TabsContent>
          <TabsContent value="avaliacoes" className="mt-4 text-sm text-muted">
            Nota média {nft.rating.toFixed(1)} de 5 com {nft.reviewsCount} avaliações. A listagem de avaliações
            individuais não faz parte desta entrega.
          </TabsContent>
        </Tabs>
      </div>

      <Related nftId={nft.id} />
    </div>
  )
}

export function QuantityStepper({
  value,
  max,
  onChange,
  disabled,
  label = 'Quantidade',
}: {
  value: number
  max: number
  onChange: (v: number) => void
  disabled?: boolean
  label?: string
}) {
  const atMax = value >= max
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <button
        type="button"
        className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= 1}
        aria-label="Diminuir quantidade"
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <output
        className="min-w-5 text-center text-lg"
        aria-live="polite"
        aria-label={`${label}: ${value}`}
        data-testid="qty-value"
      >
        {value}
      </output>
      <button
        type="button"
        className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
        onClick={() => onChange(value + 1)}
        disabled={disabled || atMax}
        aria-label={atMax ? `Aumentar quantidade (limite de ${max} atingido)` : 'Aumentar quantidade'}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  )
}

function Related({ nftId }: { nftId: string }) {
  const q = useQuery({ queryKey: qk.related(nftId), queryFn: ({ signal }) => api.relatedNfts(nftId, { signal }) })
  return <RelatedCarousel title="Mais desta coleção" items={q.data} loading={q.isPending} />
}

export function RelatedCarousel({
  title,
  items,
  loading,
}: {
  title: string
  items?: Nft[] | import('@/api/contracts').NftSummary[]
  loading: boolean
}) {
  return (
    <section aria-labelledby={`rel-${title}`} className="container-page mt-20">
      <h2 id={`rel-${title}`} className="border-b border-line pb-3 text-lg font-bold text-primary-strong">
        {title}
      </h2>
      <ul className="mt-8 flex snap-x gap-6 overflow-x-auto pb-4" aria-busy={loading}>
        {loading
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="w-[200px] shrink-0">
                <NftCardSkeleton />
              </li>
            ))
          : items?.slice(0, 10).map((n) => (
              <li key={n.id} className="w-[200px] shrink-0 snap-start lg:w-[calc((100%-96px)/5)]">
                <NftCard nft={n} compact />
              </li>
            ))}
      </ul>
    </section>
  )
}

function DetailSkeleton() {
  return (
    <div className="container-page" aria-busy="true" aria-label="Carregando NFT">
      <div className="py-6">
        <Skeleton className="h-5 w-56" />
      </div>
      <div
        className="grid gap-8 md:grid-cols-2 lg:grid-cols-[100px_395px_1fr] lg:gap-[30px]"
        data-testid="detail-skeleton"
      >
        <div className="hidden flex-col gap-3 lg:flex">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="size-[89px]" />
          ))}
        </div>
        <div className="bg-surface p-5">
          <Skeleton className="aspect-square w-full rounded-[16px]" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-2/3" />
        </div>
      </div>
    </div>
  )
}
