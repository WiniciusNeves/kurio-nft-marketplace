import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { Heart, Search, ShoppingCart } from 'lucide-react'
import type { NftSummary } from '@/api/contracts'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { useAddToCart } from '@/features/cart/useCart'
import { useFavorites, useToggleFavorite } from '@/features/favorites/useFavorites'
import { useCurrentUser } from '@/features/auth/useSession'
import { toast } from 'sonner'

export function NftCard({
  nft,
  priority = false,
  compact = false,
}: {
  nft: NftSummary
  priority?: boolean
  compact?: boolean
}) {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const { href } = useLocation()
  const favorites = useFavorites()
  const toggle = useToggleFavorite()
  const add = useAddToCart()
  const isFav = favorites.data?.nftIds.includes(nft.id) ?? false

  return (
    <article className="group relative flex flex-col" data-testid="nft-card" data-nft-id={nft.id}>
      <div className="relative flex aspect-[258/300] items-center overflow-hidden rounded-[20px] bg-surface p-1.5 md:rounded-none md:px-[1.5%] md:py-0">
        {nft.rarity && (
          <span className="absolute top-0 left-0 z-10 bg-primary px-3.5 py-1 text-sm font-medium text-primary-foreground uppercase">
            {nft.rarity === 'raro' ? 'Raro' : 'Lendário'}
          </span>
        )}
        <img
          src={nft.image}
          alt={nft.imageAlt}
          width={250}
          height={250}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          className={cn(
            'aspect-square w-full rounded-[16px] object-cover max-md:aspect-[5/6]',
            nft.soldOut && 'opacity-50 grayscale',
          )}
        />
        {nft.soldOut && (
          <span className="absolute top-3 right-3 rounded-sm bg-background/90 px-2 py-1 text-xs font-bold">
            Esgotado
          </span>
        )}
        {!compact && (
          <div className="absolute top-3 right-3 z-10 flex justify-center gap-3 transition-opacity md:inset-x-0 md:top-auto md:right-auto md:bottom-1 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
            <button
              type="button"
              className="hidden size-9 place-items-center rounded-sm bg-background text-foreground hover:text-primary-strong disabled:opacity-40 md:grid"
              aria-label={`Adicionar ${nft.name} ao carrinho`}
              disabled={nft.soldOut || add.isPending}
              onClick={() =>
                add.mutate(
                  { nftId: nft.id, editionId: '1-50', quantity: 1 },
                  { onError: (e) => toast.error(e.message) },
                )
              }
            >
              <ShoppingCart className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              className="relative z-10 grid size-9 place-items-center rounded-full bg-background/80 text-foreground hover:text-primary-strong md:rounded-sm md:bg-background"
              aria-label={isFav ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
              aria-pressed={isFav}
              onClick={() => {
                if (!user) {
                  toast.info('Entre na sua conta para favoritar.')
                  void navigate({ to: '/login', search: { redirect: href } })
                  return
                }
                toggle.mutate({ nftId: nft.id, favorite: !isFav, name: nft.name })
              }}
            >
              <Heart className={cn('size-5', isFav && 'fill-primary text-primary')} aria-hidden />
            </button>
            <Link
              to="/nft/$nftId"
              params={{ nftId: nft.id }}
              className="hidden size-9 place-items-center rounded-sm bg-background text-foreground hover:text-primary-strong md:grid"
              aria-label={`Ver detalhes de ${nft.name}`}
              tabIndex={-1}
            >
              <Search className="size-5" aria-hidden />
            </Link>
          </div>
        )}
      </div>
      <h3 className="mt-5 text-base">
        <Link
          to="/nft/$nftId"
          params={{ nftId: nft.id }}
          className="after:absolute after:inset-0 after:content-[''] hover:text-primary-strong focus-visible:outline-none [&:focus-visible]:underline"
        >
          {nft.name}
        </Link>
      </h3>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-2 text-lg font-bold text-primary-strong">
        <span>
          <span className="sr-only">Preço: </span>
          {formatEth(nft.price)}
        </span>
        {nft.compareAtPrice && (
          <s className="text-lg font-normal text-muted">
            <span className="sr-only">Preço anterior: </span>
            {formatEth(nft.compareAtPrice)}
          </s>
        )}
      </p>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      <div className="flex aspect-[258/300] items-center rounded-[20px] bg-surface p-1.5 md:rounded-none md:px-[1.5%] md:py-0">
        <Skeleton className="aspect-square w-full rounded-[16px] max-md:aspect-[5/6]" />
      </div>
      <Skeleton className="mt-5 h-5 w-3/4" />
      <Skeleton className="mt-1.5 h-6 w-1/3" />
    </div>
  )
}
