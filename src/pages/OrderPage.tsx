import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { ExternalLink, Loader2, XCircle } from 'lucide-react'
import { NETWORK_LABEL, WALLET_PROVIDER_LABEL, type Order } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { ApiError } from '@/api/errors'
import { qk } from '@/api/queryKeys'
import { ErrorState } from '@/components/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/features/auth/useSession'
import { checkoutStorage } from '@/features/checkout/checkoutStorage'
import { formatEth } from '@/lib/eth'
import { formatDate, shortAddress } from '@/lib/utils'
import { useRealtimeStatus } from '@/realtime/RealtimeIndicator'

/**
 * Estado do pedido + recibo.
 * - pending: aguarda order.updated via Socket.IO; se o socket cair, faz polling REST até reconectar.
 * - confirmed: exibe o recibo (snapshot do pedido — não depende do catálogo atual).
 * - declined: terminal; itens permanecem no carrinho.
 */
export function OrderPage() {
  const { orderId } = useParams({ from: '/orders/$orderId' })
  const user = useCurrentUser()!
  const rt = useRealtimeStatus()
  const query = useQuery({
    queryKey: qk.order(user.id, orderId),
    queryFn: ({ signal }) => api.getOrder(orderId, { signal }),
    refetchInterval: (q) => (q.state.data?.status === 'pending' && rt !== 'connected' ? 3000 : false),
    refetchOnWindowFocus: true,
  })

  // Estado terminal encerra a tentativa de checkout (próxima compra usa nova chave).
  const status = query.data?.status
  useEffect(() => {
    if (status && status !== 'pending') checkoutStorage.clearAttempt()
  }, [status])

  if (query.isPending)
    return (
      <div className="container-page py-16" aria-busy>
        <Skeleton className="mx-auto h-[600px] max-w-[578px]" />
      </div>
    )
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404)
      return (
        <div className="container-page py-24 text-center">
          <h1 className="text-2xl font-bold">Pedido não encontrado</h1>
          <Button asChild className="mt-6">
            <Link to="/mercado">Voltar ao mercado</Link>
          </Button>
        </div>
      )
    return (
      <div className="container-page py-10">
        <ErrorState error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} />
      </div>
    )
  }

  return (
    <div className="container-page py-10 md:py-16">
      {query.data.status === 'pending' && <Pending order={query.data} />}
      {query.data.status === 'declined' && <Declined order={query.data} />}
      {query.data.status === 'confirmed' && <Receipt order={query.data} />}
    </div>
  )
}

function Pending({ order }: { order: Order }) {
  return (
    <section
      className="mx-auto flex max-w-[578px] flex-col items-center gap-4 border-b-8 border-primary bg-surface px-6 py-12 text-center"
      data-testid="order-pending"
    >
      <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
      <h1 className="text-xl font-bold" role="status" aria-live="polite">
        Aguardando confirmação na rede…
      </h1>
      <p className="text-sm text-muted">
        Pedido {order.id} · {formatEth(order.total)} · {NETWORK_LABEL[order.network]}
      </p>
      <p className="max-w-sm text-xs text-muted">
        Você pode recarregar ou fechar esta página com segurança: o status será recuperado sem criar outra compra.
      </p>
    </section>
  )
}

function Declined({ order }: { order: Order }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <section
      className="mx-auto flex max-w-[578px] flex-col items-center gap-4 border-b-8 border-danger bg-surface px-6 py-12 text-center"
      data-testid="order-declined"
    >
      <XCircle className="size-10 text-danger" aria-hidden />
      <h1 ref={ref} tabIndex={-1} className="text-xl font-bold focus:outline-none" role="alert">
        Pagamento recusado
      </h1>
      <p className="text-sm text-muted">{order.failureReason}</p>
      <p className="text-sm">Nenhum valor foi cobrado e seus itens continuam no carrinho.</p>
      <Button asChild>
        <Link to="/cart">Voltar ao carrinho</Link>
      </Button>
    </section>
  )
}

function Receipt({ order }: { order: Order }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <section
      aria-labelledby="receipt-title"
      className="mx-auto max-w-[578px] border-b-8 border-primary bg-surface"
      data-testid="order-confirmed"
    >
      <div className="flex flex-col items-center gap-4 px-6 pt-6">
        <ThankYouIcon />
        <h1 id="receipt-title" ref={ref} tabIndex={-1} className="text-base font-bold text-muted focus:outline-none">
          Seus NFTs agora estão na sua carteira
        </h1>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-y-3 border-y border-primary px-6 py-3 text-sm sm:grid-cols-4 sm:divide-x sm:divide-primary">
        <div className="sm:pr-3">
          <dt className="font-bold text-muted">ID da transação</dt>
          <dd className="text-muted" data-testid="tx-id" title={order.txHash ?? ''}>
            {order.txHash ? shortAddress(order.txHash.toUpperCase().replace('0X', '0x'), 6, 4) : '—'}
          </dd>
        </div>
        <div className="sm:px-3">
          <dt className="text-muted">Data</dt>
          <dd className="text-muted">{formatDate(order.updatedAt)}</dd>
        </div>
        <div className="sm:px-3">
          <dt className="text-muted">Total</dt>
          <dd className="text-muted">{formatEth(order.total)}</dd>
        </div>
        <div className="sm:pl-3">
          <dt className="font-bold text-muted">Carteira</dt>
          <dd className="text-muted">{WALLET_PROVIDER_LABEL[order.wallet.provider]}</dd>
        </div>
      </dl>
      <div className="px-6 py-6 md:px-11">
        <h2 className="font-bold">Detalhes da transação</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="pb-2 font-bold">
                NFTs
              </th>
              <th scope="col" className="pb-2 text-center font-bold">
                Edições
              </th>
              <th scope="col" className="pb-2 text-right font-bold">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l) => (
              <tr key={`${l.nftId}-${l.editionId}`} data-testid="receipt-line">
                <td className="py-2">
                  <span className="flex items-center gap-3">
                    <img
                      src={l.image.replace('.webp', '-thumb.webp')}
                      alt=""
                      width={66}
                      height={66}
                      className="size-[66px] rounded-sm object-cover"
                    />
                    <span>
                      <span className="block font-bold">{l.name}</span>
                      <span className="text-muted">ID do token: {l.tokenId}</span>
                    </span>
                  </span>
                </td>
                <td className="text-center text-muted">(x {l.quantity})</td>
                <td className="text-right font-bold text-primary-strong">{formatEth(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {order.coupon && (
              <tr>
                <th scope="row" colSpan={2} className="pt-3 text-right font-normal">
                  Desconto ({order.coupon.code})
                </th>
                <td className="pt-3 text-right">(-) {formatEth(order.discount)}</td>
              </tr>
            )}
            <tr>
              <th scope="row" colSpan={2} className="pt-3 text-right font-normal">
                Taxa de rede
              </th>
              <td className="pt-3 text-right text-base">{formatEth(order.networkFee)}</td>
            </tr>
            <tr className="border-b border-line">
              <th scope="row" colSpan={2} className="pb-2 text-right font-bold">
                Total
              </th>
              <td className="pb-2 text-right text-base font-bold text-primary-strong" data-testid="receipt-total">
                {formatEth(order.total)}
              </td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-4 text-center text-sm leading-6 text-muted">
          Transação confirmada na {NETWORK_LABEL[order.network]}. A propriedade foi transferida para sua carteira
          conectada ({shortAddress(order.wallet.address)}) e registrada na rede.
        </p>
        <p className="mt-1 text-center text-xs text-subtle">
          Ambiente de demonstração: hash e explorador são simulados.
        </p>
        <div className="mt-5 flex flex-col items-center gap-3">
          {order.explorerUrl && (
            <Button asChild>
              <a href={order.explorerUrl} target="_blank" rel="noopener noreferrer">
                Ver no{' '}
                {order.network === 'ethereum' ? 'Etherscan' : order.network === 'polygon' ? 'Polygonscan' : 'Solscan'}
                <ExternalLink aria-hidden />
                <span className="sr-only">(abre em nova aba, link simulado)</span>
              </a>
            </Button>
          )}
          <Link to="/mercado" className="text-sm text-primary-strong hover:underline">
            Continuar explorando
          </Link>
        </div>
      </div>
    </section>
  )
}

function ThankYouIcon() {
  return (
    <svg width="66" height="80" viewBox="0 0 66 80" fill="none" aria-hidden className="text-primary">
      <path d="M33 2 L40 8 H58 V44 M33 2 L26 8 H8 V44" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="8" y="8" width="50" height="34" stroke="currentColor" strokeWidth="2.5" />
      <text
        x="33"
        y="23"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="currentColor"
        fontFamily="sans-serif"
      >
        THANK
      </text>
      <text
        x="33"
        y="36"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="currentColor"
        fontFamily="sans-serif"
      >
        YOU
      </text>
      <path d="M2 40 V78 H64 V40 L33 62 Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M2 78 L26 56 M64 78 L40 56" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  )
}
