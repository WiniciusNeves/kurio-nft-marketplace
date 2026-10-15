import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, CheckCircle2, ChevronLeft, Loader2, Plug, Unplug } from 'lucide-react'
import { toast } from 'sonner'
import {
  NETWORK_LABEL,
  WALLET_PROVIDER_LABEL,
  ensRule,
  networkSchema,
  usernameRule,
  walletProviderSchema,
  type Network,
  type Quote,
  type Wallet,
  type WalletProvider,
  type WalletSession,
} from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/queryKeys'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { ErrorState } from '@/components/ErrorState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { WalletBadges } from '@/components/WalletBadges'
import { useCurrentUser } from '@/features/auth/useSession'
import { useCart } from '@/features/cart/useCart'
import { checkoutStorage } from '@/features/checkout/checkoutStorage'
import { useCheckout } from '@/features/checkout/useCheckout'
import { formatEth } from '@/lib/eth'
import { focusFirstInvalid } from '@/lib/forms'
import { cn, shortAddress } from '@/lib/utils'
import { CouponForm, SummaryList, useCartRealtimeNotice } from './CartPage'

const formSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe o nome de exibição'),
  username: usernameRule,
  network: networkSchema,
  profileName: z.string().trim().min(2, 'Informe o nome do perfil'),
  walletAddress: z.string().trim().min(1, 'Selecione uma carteira cadastrada'),
  secondaryAddress: z.string().trim().optional(),
  walletProvider: walletProviderSchema,
  referralCode: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{4,12}$/i, 'Use 4–12 letras ou números'),
  email: z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido'),
  ensName: ensRule,
  note: z.string().max(280, 'Máximo de 280 caracteres').optional(),
})
type FormValues = z.infer<typeof formSchema>

export function CheckoutPage() {
  const user = useCurrentUser()!
  const navigate = useNavigate()
  const cart = useCart()
  useCartRealtimeNotice(cart.data)
  const wallets = useQuery({ queryKey: qk.wallets(user.id), queryFn: ({ signal }) => api.listWallets({ signal }) })
  const checkout = useCheckout(user.id)
  const [walletId, setWalletId] = useState<string | null>(null)
  const [walletSession, setWalletSession] = useState<WalletSession | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [useOther, setUseOther] = useState(false)
  const [couponOpen, setCouponOpen] = useState(false)
  const [connector, setConnector] = useState<WalletProvider>('metamask')

  const selectedWallet = wallets.data?.find((w) => w.id === walletId) ?? null

  // Retomada: pedido já criado => vai para o status; tentativa sem resposta => reenvia mesma chave.
  useEffect(() => {
    const attempt = checkoutStorage.getAttempt(user.id)
    if (attempt?.orderId) {
      void navigate({ to: '/orders/$orderId', params: { orderId: attempt.orderId }, replace: true })
    } else if (attempt) {
      toast.info('Retomando sua compra em andamento…')
      void checkout.resumePending().then((order) => {
        if (order) void navigate({ to: '/orders/$orderId', params: { orderId: order.id }, replace: true })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const draft = useMemo(() => checkoutStorage.getDraft<Partial<FormValues>>(user.id), [user.id])
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      displayName: user.displayName,
      username: user.username,
      profileName: user.ensName ?? '',
      email: user.email,
      ensName: user.ensName ?? '',
      walletAddress: '',
      secondaryAddress: '',
      referralCode: '',
      note: '',
      ...draft,
    } as FormValues,
  })

  // Rascunho persistido: sobrevive a refresh e à expiração de sessão durante o checkout.
  useEffect(() => {
    const sub = form.watch((values) => checkoutStorage.saveDraft(user.id, values))
    return () => sub.unsubscribe()
  }, [form, user.id])

  // Seleciona a carteira principal e preenche os campos derivados dela.
  useEffect(() => {
    if (!wallets.data?.length || walletId) return
    const primary = wallets.data.find((w) => w.role === 'primary') ?? wallets.data[0]
    pickWallet(primary)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets.data])

  function pickWallet(w: Wallet) {
    setWalletId(w.id)
    setWalletSession(null)
    checkout.clearQuote()
    form.setValue('walletAddress', w.address, { shouldValidate: form.formState.isSubmitted })
    form.setValue('walletProvider', w.provider)
    setConnector(w.provider)
    form.setValue('network', w.network)
    form.setValue('secondaryAddress', w.secondaryAddress ?? '')
    if (!form.getValues('referralCode')) form.setValue('referralCode', w.referralCode)
  }

  const network = form.watch('network')

  const connect = useMutation({
    mutationFn: () => api.connectWallet(walletId!, network, connector),
    onSuccess: (s) => {
      setWalletSession(s)
      toast.success(`${WALLET_PROVIDER_LABEL[s.provider]} conectada na rede ${NETWORK_LABEL[s.network]}`)
    },
    onError: (e) => toast.error(e.message),
  })
  const disconnect = () => {
    if (walletSession) void api.disconnectWallet(walletSession.id).catch(() => undefined)
    setWalletSession(null)
    checkout.clearQuote()
    toast.info('Carteira desconectada')
  }

  // Trocar a rede invalida a conexão e a cotação (taxa depende da rede).
  useEffect(() => {
    if (walletSession && walletSession.network !== network) {
      setWalletSession(null)
      checkout.clearQuote()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network])

  const onReview = form.handleSubmit(
    async (values) => {
      if (!walletSession) {
        toast.error('Conecte sua carteira antes de revisar o pedido.')
        document.getElementById('wallet-section')?.focus()
        return
      }
      const q = await checkout.requestQuote(values.network)
      if (q) setReviewOpen(true)
    },
    () => {
      focusFirstInvalid()
      toast.error('Revise os campos destacados do formulário.')
    },
  )

  const onConfirm = async () => {
    const values = form.getValues()
    if (!checkout.quote || !walletSession || !walletId) return
    const order = await checkout.confirm({
      quote: checkout.quote,
      walletId,
      walletSessionId: walletSession.id,
      network: values.network,
      buyer: {
        displayName: values.displayName,
        username: values.username,
        profileName: values.profileName,
        email: values.email,
        ensName: `${values.ensName}.eth`,
        referralCode: values.referralCode,
        note: values.note || undefined,
      },
    })
    if (order) {
      setReviewOpen(false)
      void navigate({ to: '/orders/$orderId', params: { orderId: order.id } })
    }
  }

  if (cart.isError && !cart.data)
    return (
      <div className="container-page py-10">
        <ErrorState error={cart.error} onRetry={() => cart.refetch()} />
      </div>
    )

  if (cart.data && cart.data.items.length === 0 && checkout.submit.status === 'idle') {
    return (
      <div className="container-page flex flex-col items-center gap-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Seu carrinho está vazio</h1>
        <Button asChild>
          <Link to="/mercado">Explorar NFTs</Link>
        </Button>
      </div>
    )
  }

  const cartHasIssues = cart.data?.items.some((i) => i.issues.length > 0)
  const e = form.formState.errors

  return (
    <div className="container-page">
      <div className="hidden md:block">
        <Breadcrumbs
          items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/mercado' }, { label: 'Pagamento' }]}
        />
      </div>
      <div className="flex items-center gap-4 py-6 md:hidden">
        <Link
          to="/cart"
          className="grid size-9 place-items-center rounded-full bg-band"
          aria-label="Voltar ao carrinho"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="text-lg font-bold">Pagamento com carteira</h1>
      </div>
      <h1 className="sr-only hidden md:block">Pagamento</h1>

      {checkout.submit.status === 'recovering' && (
        <p role="status" className="mb-4 flex items-center gap-2 border border-line bg-surface p-3 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Sem resposta do servidor. Verificando se o pedido foi
          criado (tentativa {checkout.submit.attempt})…
        </p>
      )}

      <form
        onSubmit={onReview}
        noValidate
        className="grid gap-10 pb-48 lg:grid-cols-[1fr_405px] lg:grid-rows-[auto_auto_1fr] lg:gap-8 lg:pb-0"
      >
        {/* Dados do colecionador */}
        <section aria-labelledby="buyer-title" className="order-2 lg:col-start-1 lg:row-span-3 lg:row-start-1">
          <h2 id="buyer-title" className="mb-4 text-lg font-bold">
            Perfil do colecionador
          </h2>
          <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
            <Field id="displayName" label="Nome de exibição" required error={e.displayName?.message}>
              {(a) => <Input {...a} {...form.register('displayName')} autoComplete="name" />}
            </Field>
            <Field id="username" label="Nome de usuário" required error={e.username?.message}>
              {(a) => <Input {...a} {...form.register('username')} autoComplete="username" />}
            </Field>
            <Field id="network" label="Rede" required error={e.network?.message}>
              {(a) => (
                <Controller
                  control={form.control}
                  name="network"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as Network)}>
                      <SelectTrigger {...a} onBlur={field.onBlur} data-testid="network-select">
                        <SelectValue placeholder="Selecione uma rede" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(NETWORK_LABEL) as Network[]).map((n) => (
                          <SelectItem key={n} value={n}>
                            {NETWORK_LABEL[n]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </Field>
            <Field id="profileName" label="Nome do perfil" required error={e.profileName?.message}>
              {(a) => <Input {...a} {...form.register('profileName')} />}
            </Field>
            <Field
              id="walletAddress"
              label="Endereço da carteira"
              required
              error={e.walletAddress?.message}
              hint="Definido pela carteira selecionada"
            >
              {(a) => (
                <Input
                  {...a}
                  {...form.register('walletAddress')}
                  readOnly
                  placeholder="Endereço 0x da carteira"
                  className="text-muted"
                />
              )}
            </Field>
            <Field
              id="secondaryAddress"
              label="ENS ou carteira secundária (opcional)"
              error={e.secondaryAddress?.message}
              className="md:pt-0"
            >
              {(a) => (
                <Input
                  {...a}
                  {...form.register('secondaryAddress')}
                  placeholder="ENS ou carteira secundária (opcional)"
                />
              )}
            </Field>
            <Field id="walletProvider" label="Tipo de carteira" required error={e.walletProvider?.message}>
              {(a) => (
                <Input
                  {...a}
                  readOnly
                  value={form.watch('walletProvider') ? WALLET_PROVIDER_LABEL[form.watch('walletProvider')] : ''}
                  placeholder="Selecione uma carteira"
                  className="text-muted"
                />
              )}
            </Field>
            <Field id="referralCode" label="Código de indicação" required error={e.referralCode?.message}>
              {(a) => <Input {...a} {...form.register('referralCode')} />}
            </Field>
            <Field id="email" label="E-mail" required error={e.email?.message}>
              {(a) => <Input {...a} type="email" {...form.register('email')} autoComplete="email" />}
            </Field>
            <Field id="ensName" label="Nome ENS" required error={e.ensName?.message}>
              {(a) => (
                <div className="flex gap-2">
                  <Input {...a} {...form.register('ensName')} placeholder="seunome" />
                  <span className="grid h-10 shrink-0 place-items-center rounded-sm border border-line px-3 text-sm">
                    .eth
                  </span>
                </div>
              )}
            </Field>
          </div>
          <label className="mt-5 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useOther}
              onChange={(ev) => setUseOther(ev.target.checked)}
              className="size-4 accent-[var(--color-primary)]"
            />
            Usar outra carteira?
          </label>
          {useOther && (
            <p className="mt-2 text-sm text-muted">
              Selecione outra carteira em “Carteira conectada” ou{' '}
              <Link to="/account/wallets" className="text-primary-strong underline">
                cadastre uma nova carteira
              </Link>
              .
            </p>
          )}
          <Field
            id="note"
            label="Observação do colecionador (opcional)"
            error={e.note?.message}
            className="mt-5 md:max-w-[350px]"
          >
            {(a) => <Textarea {...a} {...form.register('note')} />}
          </Field>
        </section>

        {/* Resumo (desktop: coluna direita, topo) */}
        <aside aria-labelledby="your-nfts" className="order-3 lg:col-start-2 lg:row-start-1">
          <h2 id="your-nfts" className="text-lg font-bold">
            Seus NFTs
          </h2>
          <div className="mt-2 flex justify-between text-base font-bold">
            <span>NFTs</span>
            <span>Subtotal</span>
          </div>
          <ul className="mt-2 space-y-3" data-testid="checkout-items">
            {cart.isPending
              ? Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-[70px]" />)
              : cart.data?.items.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center gap-2 overflow-hidden rounded-xl bg-surface pr-3 lg:rounded-none"
                  >
                    <img
                      src={i.image.replace('.webp', '-thumb.webp')}
                      alt=""
                      width={70}
                      height={70}
                      className="size-[70px] object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{i.name}</p>
                      <p className="text-sm text-muted">ID do token: {i.tokenId}</p>
                      {i.issues.length > 0 && (
                        <p className="text-xs text-warning">⚠ Valores alterados — revise no carrinho</p>
                      )}
                    </div>
                    <span className="text-sm text-muted">(x {i.quantity})</span>
                    <span className="font-bold text-primary-strong">{formatEth(i.lineTotal)}</span>
                  </li>
                ))}
          </ul>
          {couponOpen || cart.data?.summary.coupon ? (
            <CouponForm cart={cart.data} compact />
          ) : (
            <button
              type="button"
              className="mt-3 w-full text-center text-sm hover:text-primary-strong"
              onClick={() => setCouponOpen(true)}
            >
              Tem um código promocional? <span className="underline">Aplique aqui</span>
            </button>
          )}
          <SummaryList cart={cart.data} loading={cart.isPending} />
        </aside>

        {/* Carteira e rede (mobile: primeiro bloco, como no frame "Pagamento com carteira") */}
        <section
          id="wallet-section"
          tabIndex={-1}
          aria-label="Carteira e rede"
          className="order-1 focus:outline-none lg:col-start-2 lg:row-start-2"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Carteira conectada</h2>
            <Link to="/account/wallets" className="text-sm font-bold text-primary-strong hover:underline">
              Trocar carteira
            </Link>
          </div>
          {wallets.isPending ? (
            <Skeleton className="mt-3 h-24 rounded-2xl" />
          ) : wallets.data?.length ? (
            <RadioGroup
              value={walletId ?? ''}
              onValueChange={(id) => pickWallet(wallets.data!.find((w) => w.id === id)!)}
              className="mt-3 gap-4"
              aria-label="Carteira cadastrada"
            >
              {wallets.data.map((w) => (
                <label
                  key={w.id}
                  htmlFor={`wallet-${w.id}`}
                  className={cn(
                    'flex cursor-pointer items-start gap-4 rounded-2xl border bg-surface px-4 py-4 lg:rounded-none',
                    walletId === w.id ? 'border-primary' : 'border-transparent',
                  )}
                >
                  <RadioGroupItem id={`wallet-${w.id}`} value={w.id} className="mt-1" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-bold">
                      {w.nickname}{' '}
                      <span className="font-normal text-muted">
                        · {w.role === 'primary' ? 'Principal' : 'Secundária'}
                      </span>
                    </span>
                    <span className="truncate text-sm text-muted">
                      {w.ensName ? `${w.ensName}.eth` : shortAddress(w.address)}
                    </span>
                    <span className="text-sm text-muted">
                      {shortAddress(w.address)} · Rede {NETWORK_LABEL[w.network]}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          ) : (
            <p className="mt-3 rounded-2xl border border-line p-4 text-sm lg:rounded-none">
              Você ainda não tem carteiras cadastradas.{' '}
              <Link to="/account/wallets" className="text-primary-strong underline">
                Cadastrar carteira
              </Link>
            </p>
          )}

          <h2 className="mt-6 text-lg font-bold lg:text-center">Carteira e rede</h2>
          <RadioGroup
            value={connector}
            onValueChange={(v) => {
              setConnector(v as WalletProvider)
              if (walletSession) disconnect()
            }}
            className="mt-3 gap-3"
            aria-label="Aplicativo de carteira"
          >
            {(['walletconnect', 'metamask', 'coinbase'] as WalletProvider[]).map((pv) => (
              <label
                key={pv}
                htmlFor={`connector-${pv}`}
                className={cn(
                  'flex cursor-pointer items-center gap-4 rounded-2xl border bg-surface px-4 py-3 lg:rounded-none lg:bg-transparent',
                  connector === pv ? 'border-foreground' : 'border-line',
                )}
              >
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-full border border-line-soft bg-background text-sm font-bold text-primary-strong"
                  aria-hidden
                >
                  {pv === 'walletconnect' ? 'W' : pv === 'metamask' ? 'M' : 'C'}
                </span>
                <span className="flex-1 text-[15px]">
                  {WALLET_PROVIDER_LABEL[pv]}
                  {pv === 'walletconnect' && <WalletBadges className="ml-2 hidden align-middle xl:inline-flex" />}
                </span>
                <RadioGroupItem id={`connector-${pv}`} value={pv} />
              </label>
            ))}
          </RadioGroup>

          {selectedWallet && (
            <div
              className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-line p-3 text-sm lg:rounded-none"
              data-testid="wallet-connection"
              aria-live="polite"
            >
              {walletSession ? (
                <>
                  <span className="flex items-center gap-2 text-success">
                    <CheckCircle2 className="size-4" aria-hidden /> Conectada via{' '}
                    {WALLET_PROVIDER_LABEL[walletSession.provider]} em {NETWORK_LABEL[walletSession.network]}
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={disconnect}>
                    <Unplug aria-hidden /> Desconectar
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-muted">Carteira não conectada</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => connect.mutate()}
                    loading={connect.isPending}
                    disabled={!network}
                  >
                    <Plug aria-hidden /> Conectar carteira
                  </Button>
                </>
              )}
            </div>
          )}
        </section>

        {/* Ações — desktop */}
        <div className="hidden lg:col-start-2 lg:row-start-3 lg:block">
          {checkout.quoteError && (
            <p role="alert" className="mb-3 text-sm text-danger">
              {checkout.quoteError.message}
            </p>
          )}
          <Button
            type="submit"
            className="h-11 w-full rounded-sm"
            loading={checkout.quoting}
            disabled={!cart.data?.items.length || cartHasIssues || checkout.isSubmitting}
          >
            Confirmar compra
          </Button>
          {cartHasIssues && <CartChangedNotice />}
        </div>

        {/* Ações — mobile/tablet: barra fixa com total (Figma: Mobile / Pagamento) */}
        <div className="fixed inset-x-0 bottom-0 z-30 rounded-t-[28px] border-t border-line bg-surface px-6 pt-4 pb-5 lg:hidden">
          {checkout.quoteError && (
            <p role="alert" className="mb-2 text-sm text-danger">
              {checkout.quoteError.message}
            </p>
          )}
          {cartHasIssues && <CartChangedNotice />}
          <p className="mb-3 flex items-center justify-end gap-4 text-lg font-bold">
            Total:
            <span className="text-xl text-primary-strong">{cart.data ? formatEth(cart.data.summary.total) : '—'}</span>
          </p>
          <Button
            type="submit"
            className="h-14 w-full rounded-2xl cta-gradient text-base"
            loading={checkout.quoting}
            disabled={!cart.data?.items.length || cartHasIssues || checkout.isSubmitting}
          >
            Confirmar compra
          </Button>
        </div>
      </form>

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={(o) => !checkout.isSubmitting && setReviewOpen(o)}
        quote={checkout.quote}
        previous={checkout.previousQuote}
        stale={checkout.quoteStale}
        walletLabel={
          selectedWallet
            ? `${selectedWallet.nickname} (${WALLET_PROVIDER_LABEL[walletSession?.provider ?? connector]})`
            : ''
        }
        submitting={checkout.isSubmitting}
        submitError={checkout.submit.status === 'error' ? checkout.submit.error.message : null}
        refreshing={checkout.quoting}
        onRefresh={() => void checkout.requestQuote(network)}
        onConfirm={onConfirm}
      />
    </div>
  )
}

function ReviewDialog({
  open,
  onOpenChange,
  quote,
  previous,
  stale,
  walletLabel,
  submitting,
  submitError,
  refreshing,
  onRefresh,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  quote: Quote | null
  previous: Quote | null
  stale: boolean
  walletLabel: string
  submitting: boolean
  submitError: string | null
  refreshing: boolean
  onRefresh: () => void
  onConfirm: () => void
}) {
  if (!quote) return null
  const changed = previous && previous.fingerprint !== quote.fingerprint
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[560px]"
        data-testid="review-dialog"
        onEscapeKeyDown={(e) => submitting && e.preventDefault()}
      >
        <DialogTitle className="text-xl font-bold">Revise seu pedido</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted">
          Valores cotados em {NETWORK_LABEL[quote.network]}. A cotação vale até{' '}
          {new Date(quote.expiresAt).toLocaleTimeString('pt-BR')}.
        </DialogDescription>

        {stale && (
          <div
            role="alert"
            className="mt-4 flex flex-col gap-3 border border-warning p-3 text-sm"
            data-testid="quote-stale"
          >
            <p className="flex gap-2">
              <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
              Preço ou disponibilidade mudaram durante a revisão. Atualize a cotação para continuar.
            </p>
            <Button size="sm" variant="outline" onClick={onRefresh} loading={refreshing}>
              Atualizar cotação
            </Button>
          </div>
        )}
        {!stale && changed && (
          <div role="alert" className="mt-4 border border-warning p-3 text-sm" data-testid="quote-changed">
            <p className="flex gap-2">
              <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
              Os valores foram atualizados: total de {formatEth(previous.total)} para{' '}
              <strong>{formatEth(quote.total)}</strong>. Confirme novamente para continuar.
            </p>
          </div>
        )}

        <ul className="mt-4 divide-y divide-line border-y border-line">
          {quote.lines.map((l) => {
            const prev = previous?.lines.find((p) => p.nftId === l.nftId && p.editionId === l.editionId)
            return (
              <li key={`${l.nftId}-${l.editionId}`} className="flex items-center gap-3 py-3 text-sm">
                <img
                  src={l.image.replace('.webp', '-thumb.webp')}
                  alt=""
                  width={48}
                  height={48}
                  className="size-12 rounded-sm object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{l.name}</span>
                  <span className="text-muted">
                    {l.editionLabel} · {formatEth(l.unitPrice)} × {l.quantity}
                    {prev && prev.unitPrice !== l.unitPrice && <s className="ml-1">{formatEth(prev.unitPrice)}</s>}
                  </span>
                </span>
                <span className="font-bold text-primary-strong">{formatEth(l.lineTotal)}</span>
              </li>
            )
          })}
        </ul>
        <SummaryList summary={quote} />
        <p className="mt-4 text-sm">
          Pagamento com <strong>{walletLabel}</strong>
        </p>
        {submitError && (
          <p role="alert" className="mt-3 text-sm text-danger" data-testid="submit-error">
            {submitError}
          </p>
        )}
        <Button
          className="mt-6 w-full"
          onClick={onConfirm}
          loading={submitting}
          disabled={stale || submitting || refreshing}
          data-testid="confirm-order"
        >
          {submitting ? 'Enviando pedido…' : 'Confirmar e pagar'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

function CartChangedNotice() {
  return (
    <p className="mt-2 mb-2 text-xs text-warning">
      Itens do carrinho mudaram.{' '}
      <Link to="/cart" className="underline">
        Revise no carrinho
      </Link>{' '}
      antes de continuar.
    </p>
  )
}
