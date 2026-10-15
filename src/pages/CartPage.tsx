import { useEffect, useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ChevronLeft, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Cart, CartItem } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { ApiError } from '@/api/errors'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { ErrorState } from '@/components/ErrorState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useSessionState } from '@/features/auth/useSession'
import {
  useAcknowledgeCart,
  useApplyCoupon,
  useCart,
  useRemoveCartItem,
  useRemoveCoupon,
  useUpdateCartQuantity,
} from '@/features/cart/useCart'
import { formatEth } from '@/lib/eth'
import { realtime } from '@/realtime/realtime'
import { QuantityStepper, RelatedCarousel } from './NftDetailPage'

/** Avisa (toast em região aria-live) quando um item do carrinho muda em tempo real. */
export function useCartRealtimeNotice(cart: Cart | undefined) {
  useEffect(
    () =>
      realtime.onNftUpdated((e) => {
        const item = cart?.items.find((i) => i.nftId === e.payload.nftId)
        if (!item) return
        const ed = e.payload.editions.find((x) => x.id === item.editionId)
        if (!ed) return
        if (ed.available === 0) toast.warning(`${item.name} (${item.editionLabel}) esgotou.`)
        else if (ed.price !== item.unitPrice)
          toast.warning(`O preço de ${item.name} mudou para ${formatEth(ed.price)}.`)
        else if (ed.available < item.quantity)
          toast.warning(`Restam apenas ${ed.available} unidade(s) de ${item.name}.`)
      }),
    [cart],
  )
}

export function CartPage() {
  const cart = useCart()
  const navigate = useNavigate()
  const session = useSessionState()
  useCartRealtimeNotice(cart.data)
  const ack = useAcknowledgeCart()
  const suggestions = useQuery({
    queryKey: ['catalog', 'suggestions'],
    queryFn: ({ signal }) => api.listNfts({ sort: 'recent', page: 1, pageSize: 10 }, { signal }),
  })

  const data = cart.data
  const hasIssues = data?.items.some((i) => i.issues.length > 0) ?? false
  const empty = data && data.items.length === 0

  const checkout = () => {
    if (session.status !== 'authenticated') {
      toast.info('Entre na sua conta para finalizar a compra. Seus itens serão mantidos.')
      void navigate({ to: '/login', search: { redirect: '/checkout' } })
      return
    }
    void navigate({ to: '/checkout' })
  }

  return (
    <div>
      <div className="container-page">
        <div className="hidden md:block">
          <Breadcrumbs
            items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/mercado' }, { label: 'Carrinho' }]}
          />
        </div>
        <div className="flex items-center gap-4 py-6 md:hidden">
          <Link
            to="/mercado"
            className="grid size-9 place-items-center rounded-full bg-band"
            aria-label="Voltar ao mercado"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <h1 className="flex-1 pr-9 text-center text-lg font-bold">Carrinho de NFTs</h1>
        </div>
        <h1 className="sr-only hidden md:block">Carrinho de NFTs</h1>

        {cart.isError && !data ? (
          <ErrorState
            error={cart.error}
            title="Não foi possível carregar o carrinho"
            onRetry={() => cart.refetch()}
            retrying={cart.isFetching}
          />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_332px] lg:gap-[86px]">
            <section aria-labelledby="cart-items-title">
              <h2 id="cart-items-title" className="sr-only">
                Itens do carrinho
              </h2>
              {hasIssues && (
                <div
                  role="alert"
                  className="mb-4 flex flex-col gap-3 border border-warning/60 bg-surface p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                  data-testid="cart-issues"
                >
                  <p className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                    Preço ou disponibilidade de itens mudaram desde que você os adicionou. Revise antes de continuar.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => ack.mutate()} loading={ack.isPending}>
                    Aceitar valores atuais
                  </Button>
                </div>
              )}
              <div className="hidden grid-cols-[1fr_120px_140px_120px_40px] items-center border-b border-line pb-2 text-base font-bold md:grid">
                <span>NFTs</span>
                <span>Preço</span>
                <span>Edições</span>
                <span>Total</span>
                <span className="sr-only">Ações</span>
              </div>
              {cart.isPending ? (
                <ul className="mt-3 space-y-3" aria-busy>
                  {Array.from({ length: 3 }, (_, i) => (
                    <li key={i}>
                      <Skeleton className="h-[70px] w-full md:h-[70px]" />
                    </li>
                  ))}
                </ul>
              ) : empty ? (
                <div
                  className="mt-6 flex flex-col items-center gap-3 border border-line bg-surface px-6 py-12 text-center"
                  data-testid="cart-empty"
                >
                  <p className="text-lg font-bold">Seu carrinho está vazio</p>
                  <p className="text-sm text-muted">Explore o mercado e adicione NFTs para continuar.</p>
                  <Button asChild>
                    <Link to="/mercado">Explorar NFTs</Link>
                  </Button>
                </div>
              ) : (
                <ul className="mt-3 space-y-3" data-testid="cart-items">
                  {data?.items.map((item) => (
                    <CartRow key={item.id} item={item} />
                  ))}
                </ul>
              )}
            </section>

            <aside
              aria-labelledby="summary-title"
              className="-mx-4 rounded-t-[28px] bg-surface px-6 py-6 md:mx-0 lg:rounded-none lg:bg-transparent lg:p-0"
            >
              <h2 id="summary-title" className="hidden border-b border-line pb-3 text-lg font-bold lg:block">
                Resumo da carteira
              </h2>
              <CouponForm cart={data} />
              <SummaryList cart={data} loading={cart.isPending} />
              <Button
                className="mt-6 h-14 w-full rounded-2xl text-base max-lg:cta-gradient lg:h-10 lg:rounded-sm lg:text-sm"
                onClick={checkout}
                disabled={!data || data.items.length === 0 || hasIssues}
                aria-describedby={hasIssues ? 'checkout-blocked' : undefined}
              >
                Conectar e finalizar
              </Button>
              {hasIssues && (
                <p id="checkout-blocked" className="mt-2 text-xs text-warning">
                  Aceite os valores atuais para continuar.
                </p>
              )}
              <Link to="/mercado" className="mt-5 block text-center text-sm text-primary-strong hover:underline">
                Continuar explorando
              </Link>
            </aside>
          </div>
        )}
      </div>
      <RelatedCarousel
        title="Colecionadores também viram"
        items={suggestions.data?.items}
        loading={suggestions.isPending}
      />
    </div>
  )
}

function CartRow({ item }: { item: CartItem }) {
  const update = useUpdateCartQuantity()
  const remove = useRemoveCartItem()
  const max = Math.max(1, Math.min(item.maxPerOrder, item.available))
  const priceChanged = item.issues.includes('PRICE_CHANGED')
  return (
    <li
      className="relative grid grid-cols-[100px_1fr] overflow-hidden rounded-xl bg-surface md:grid-cols-[1fr_120px_140px_120px_40px] md:items-center md:rounded-none"
      data-testid="cart-item"
      data-nft-id={item.nftId}
    >
      <div className="contents md:flex md:items-center md:gap-4">
        <img
          src={item.image.replace('.webp', '-thumb.webp')}
          alt=""
          width={70}
          height={70}
          className="h-full min-h-[100px] w-[100px] object-cover md:size-[70px] md:min-h-0"
        />
        <div className="flex min-w-0 flex-col justify-center p-3 md:p-0">
          <Link
            to="/nft/$nftId"
            params={{ nftId: item.nftId }}
            className="truncate font-bold hover:text-primary-strong"
          >
            {item.name}
          </Link>
          <span className="text-sm text-muted">ID do token: {item.tokenId}</span>
          <span className="text-sm text-muted">Edição: {item.editionLabel}</span>
          {/* Mobile: preço + stepper no card */}
          <div className="mt-2 flex items-center justify-between md:hidden">
            <span className="text-lg font-bold text-primary-strong">{formatEth(item.lineTotal)}</span>
            <QuantityStepper
              value={item.quantity}
              max={max}
              onChange={(q) => update.mutate({ itemId: item.id, quantity: q })}
              label={`Quantidade de ${item.name}`}
            />
          </div>
          <ItemIssues item={item} />
        </div>
      </div>
      <span className="hidden font-bold text-primary-strong md:block">
        {priceChanged && (
          <s className="mr-1 block text-xs font-normal text-muted">
            <span className="sr-only">Antes: </span>
            {formatEth(item.acknowledgedUnitPrice)}
          </s>
        )}
        {formatEth(item.unitPrice)}
      </span>
      <span className="hidden md:block">
        <QuantityStepper
          value={item.quantity}
          max={max}
          onChange={(q) => update.mutate({ itemId: item.id, quantity: q })}
          label={`Quantidade de ${item.name}`}
        />
      </span>
      <span className="hidden font-bold text-primary-strong md:block" data-testid="line-total">
        {formatEth(item.lineTotal)}
      </span>
      <button
        type="button"
        onClick={() => remove.mutate(item.id)}
        disabled={remove.isPending}
        className="absolute top-3 right-3 grid size-9 place-items-center text-primary hover:text-primary-strong md:static"
        aria-label={`Remover ${item.name} do carrinho`}
      >
        <Trash2 className="size-5" aria-hidden />
      </button>
    </li>
  )
}

function ItemIssues({ item }: { item: CartItem }) {
  if (!item.issues.length) return null
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-warning" data-testid="item-issues">
      {item.issues.includes('PRICE_CHANGED') && (
        <li>
          <span aria-hidden>⚠ </span>Preço alterado de {formatEth(item.acknowledgedUnitPrice)} para{' '}
          {formatEth(item.unitPrice)}
        </li>
      )}
      {item.issues.includes('SOLD_OUT') && (
        <li>
          <span aria-hidden>⚠ </span>Edição esgotada
        </li>
      )}
      {item.issues.includes('INSUFFICIENT_AVAILABILITY') && (
        <li>
          <span aria-hidden>⚠ </span>Restam apenas {item.available} unidade(s)
        </li>
      )}
    </ul>
  )
}

export function CouponForm({ cart, compact }: { cart: Cart | undefined; compact?: boolean }) {
  const id = useId()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()

  if (cart?.summary.coupon) {
    return (
      <div
        className="mt-5 flex items-center justify-between gap-2 rounded-sm border border-primary px-3 py-2 text-sm"
        data-testid="coupon-applied"
      >
        <span>
          Cupom <strong>{cart.summary.coupon.code}</strong> — {cart.summary.coupon.description}
        </span>
        <button
          type="button"
          onClick={() => remove.mutate()}
          aria-label={`Remover cupom ${cart.summary.coupon.code}`}
          className="text-primary"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    )
  }
  return (
    <form
      className="mt-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        if (!code.trim()) {
          setError('Informe um código promocional')
          return
        }
        apply.mutate(code.trim(), {
          onSuccess: () => setCode(''),
          onError: (err) =>
            setError(err instanceof ApiError ? (err.fieldErrors.code ?? err.message) : 'Não foi possível aplicar'),
        })
      }}
    >
      <label htmlFor={id} className={compact ? 'sr-only' : 'mb-2 block text-sm font-bold'}>
        Código promocional
      </label>
      <div className="flex">
        <Input
          id={id}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Digite o código promocional..."
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-err` : undefined}
          className="h-10 rounded-r-none border-primary text-xs md:rounded-l-sm"
          data-testid="coupon-input"
        />
        <Button type="submit" loading={apply.isPending} className="h-10 rounded-l-none rounded-r-sm px-5">
          Aplicar
        </Button>
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-2 text-xs text-danger" data-testid="coupon-error">
          <span aria-hidden>⚠ </span>
          {error}
        </p>
      )}
    </form>
  )
}

export function SummaryList({ cart, loading, summary }: { cart?: Cart; loading?: boolean; summary?: Cart['summary'] }) {
  const s = summary ?? cart?.summary
  if (loading || !s)
    return (
      <div className="mt-5 space-y-3" aria-busy data-testid="summary-skeleton">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-6" />
        ))}
      </div>
    )
  return (
    <dl className="mt-5 space-y-3 text-[15px]" data-testid="cart-summary" aria-live="polite">
      <div className="flex justify-between">
        <dt>Subtotal</dt>
        <dd className="text-lg" data-testid="summary-subtotal">
          {formatEth(s.subtotal)}
        </dd>
      </div>
      <div className="flex justify-between">
        <dt>{s.coupon ? `Desconto (${s.coupon.code})` : 'Desconto do lançamento'}</dt>
        <dd data-testid="summary-discount">(-) {formatEth(s.discount, { suffix: Number(s.discount) > 0 })}</dd>
      </div>
      <div className="flex flex-wrap justify-between">
        <dt>Taxa de rede</dt>
        <dd className="text-lg" data-testid="summary-fee">
          {formatEth(s.networkFee)}
        </dd>
        <span className="w-full text-right text-xs text-primary-strong">Taxa estimada</span>
      </div>
      <div className="flex justify-between border-t border-line pt-4 font-bold">
        <dt className="text-lg">Total</dt>
        <dd className="text-lg text-primary-strong" data-testid="summary-total">
          {formatEth(s.total)}
        </dd>
      </div>
    </dl>
  )
}
