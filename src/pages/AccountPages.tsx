import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertTriangle,
  Download,
  Heart,
  ImageIcon,
  LifeBuoy,
  LogOut,
  MapPin,
  ShoppingCart,
  TrendingUp,
  User as UserIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  NETWORK_LABEL,
  WALLET_PROVIDER_LABEL,
  passwordChangeInputSchema,
  profileInputSchema,
  walletInputSchema,
  type Network,
  type PasswordChangeInput,
  type ProfileInput,
  type Wallet,
  type WalletInput,
  type WalletProvider,
} from '@/api/contracts'
import { api } from '@/api/endpoints'
import { ApiError } from '@/api/errors'
import { qk } from '@/api/queryKeys'
import { ErrorState } from '@/components/ErrorState'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { sessionStore } from '@/features/auth/sessionStore'
import { useLogout } from '@/features/auth/useAuthActions'
import { useCurrentUser } from '@/features/auth/useSession'
import { NftCard, NftCardSkeleton } from '@/features/catalog/NftCard'
import { useFavoriteItems } from '@/features/favorites/useFavorites'
import { cn } from '@/lib/utils'
import { focusFirstInvalid } from '@/lib/forms'
import { applyServerErrors } from './AuthPages'

const MENU = [
  { label: 'Dados do perfil', to: '/account/profile', Icon: UserIcon },
  { label: 'Carteiras', to: '/account/wallets', Icon: MapPin },
  { label: 'Atividade', to: '/em-breve', secao: 'atividade', Icon: ShoppingCart },
  { label: 'Lista de interesse', to: '/account/favorites', Icon: Heart },
  { label: 'Ofertas', to: '/em-breve', secao: 'ofertas', Icon: TrendingUp },
  { label: 'Arquivos baixados', to: '/em-breve', secao: 'downloads', Icon: Download },
  { label: 'Suporte', to: '/em-breve', secao: 'suporte', Icon: LifeBuoy },
] as const

export function AccountLayout() {
  const { pathname } = useLocation()
  const logout = useLogout()
  const user = useCurrentUser()
  const logoutButton = (className: string) => (
    <button
      type="button"
      onClick={() => logout.mutate()}
      className={cn('flex items-center gap-3 text-[15px] font-bold text-primary-strong hover:bg-surface-2', className)}
    >
      <LogOut className="size-4" aria-hidden /> Sair
    </button>
  )
  return (
    <div className="container-page grid gap-6 py-6 md:grid-cols-[220px_minmax(0,1fr)] md:py-8 lg:grid-cols-[310px_minmax(0,1fr)] lg:gap-7">
      <nav aria-label="Minha conta" className="h-fit min-w-0 rounded-[20px] bg-surface py-4 md:rounded-none">
        <div className="flex items-center justify-between gap-3 px-3">
          <h2 className="text-lg font-bold">Meu perfil</h2>
          {/* Mobile: identificação do usuário + sair no topo (não há frame mobile; adaptado do desktop) */}
          <div className="flex items-center gap-3 md:hidden">
            {user && (
              <span className="flex min-w-0 items-center gap-2 text-sm text-muted">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="size-7 rounded-full object-cover" />
                ) : (
                  <UserIcon className="size-4" aria-hidden />
                )}
                <span className="max-w-28 truncate">{user.displayName}</span>
              </span>
            )}
          </div>
        </div>
        <ul className="mt-3 flex gap-2 overflow-x-auto px-3 pb-1 md:mt-2 md:block md:px-0 md:pb-0">
          {MENU.map((m) => {
            const active = pathname === m.to
            return (
              <li key={m.label} className="shrink-0">
                <Link
                  to={m.to}
                  search={'secao' in m ? { secao: m.secao } : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 text-sm whitespace-nowrap text-primary-strong md:gap-3 md:text-[15px]',
                    'rounded-full border px-3 py-2 md:rounded-none md:border-0 md:border-l-4 md:py-2.5',
                    active
                      ? 'border-primary bg-surface-2 font-bold'
                      : 'border-line-soft hover:bg-surface-2 md:border-transparent',
                  )}
                >
                  <m.Icon className="size-4" aria-hidden />
                  {m.label}
                </Link>
              </li>
            )
          })}
          <li className="shrink-0 md:hidden">
            {logoutButton('rounded-full border border-line-soft px-3 py-2 text-sm')}
          </li>
        </ul>
        <div className="mt-2 hidden border-t border-line pt-2 md:block">{logoutButton('w-full px-3 py-2.5')}</div>
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Perfil                                                              */
/* ------------------------------------------------------------------ */

export function ProfilePage() {
  const user = useCurrentUser()!
  const qc = useQueryClient()
  const profile = useQuery({ queryKey: qk.profile(user.id), queryFn: ({ signal }) => api.getProfile({ signal }) })

  if (profile.isPending)
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-6 w-56" />
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    )
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
  return (
    <ProfileForms
      data={profile.data}
      onSaved={(u) => {
        qc.setQueryData(qk.profile(user.id), u)
        sessionStore.updateUser(u)
      }}
    />
  )
}

function ProfileForms({
  data,
  onSaved,
}: {
  data: import('@/api/contracts').User
  onSaved: (u: import('@/api/contracts').User) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const profileForm = useForm<ProfileInput>({
    resolver: zodResolver(profileInputSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      displayName: data.displayName,
      username: data.username,
      email: data.email,
      ensName: data.ensName ?? '',
      walletNickname: data.walletNickname ?? '',
    },
  })
  const pwForm = useForm<PasswordChangeInput>({
    resolver: zodResolver(passwordChangeInputSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const saveProfile = useMutation({ mutationFn: api.updateProfile, onSuccess: onSaved })
  const changePassword = useMutation({ mutationFn: api.changePassword })
  const avatar = useMutation({
    mutationFn: (f: File | null) => (f ? api.uploadAvatar(f) : api.removeAvatar()),
    onSuccess: (u, f) => {
      onSaved(u)
      setAvatarError(null)
      toast.success(f ? 'Avatar atualizado' : 'Avatar removido')
    },
    onError: (e) =>
      setAvatarError(e instanceof ApiError ? (e.fieldErrors.avatar ?? e.message) : 'Falha ao enviar avatar'),
  })

  const onSave = async () => {
    const pw = pwForm.getValues()
    const wantsPw = Boolean(pw.currentPassword || pw.newPassword || pw.confirmPassword)
    const okProfile = await profileForm.trigger()
    const okPw = wantsPw ? await pwForm.trigger() : true
    if (!okProfile || !okPw) {
      focusFirstInvalid()
      toast.error('Revise os campos destacados.')
      return
    }
    try {
      const u = await saveProfile.mutateAsync(profileForm.getValues())
      profileForm.reset({
        ...profileForm.getValues(),
        ensName: u.ensName ?? '',
        walletNickname: u.walletNickname ?? '',
      })
    } catch (err) {
      applyServerErrors(err, profileForm.setError)
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar perfil')
      return
    }
    if (wantsPw) {
      try {
        await changePassword.mutateAsync(pwForm.getValues())
        pwForm.reset()
        toast.success('Senha alterada')
      } catch (err) {
        applyServerErrors(err, pwForm.setError)
        toast.error(err instanceof Error ? err.message : 'Falha ao alterar senha')
        return
      }
    }
    toast.success('Perfil salvo')
  }

  const pe = profileForm.formState.errors
  const we = pwForm.formState.errors
  const saving = saveProfile.isPending || changePassword.isPending

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void onSave()
      }}
    >
      <h1 className="text-base font-bold">Perfil do colecionador</h1>
      <div className="mt-8 grid gap-x-7 gap-y-7 md:grid-cols-2">
        <Field id="p-displayName" label="Nome de exibição" required error={pe.displayName?.message}>
          {(a) => <Input {...a} {...profileForm.register('displayName')} autoComplete="name" />}
        </Field>
        <Field id="p-username" label="Nome de usuário" required error={pe.username?.message}>
          {(a) => <Input {...a} {...profileForm.register('username')} autoComplete="username" />}
        </Field>
        <Field id="p-email" label="E-mail" required error={pe.email?.message}>
          {(a) => <Input {...a} type="email" {...profileForm.register('email')} autoComplete="email" />}
        </Field>
        <Field id="p-ensName" label="Nome ENS" required error={pe.ensName?.message}>
          {(a) => (
            <div className="flex gap-2">
              <span
                className="grid h-10 w-[78px] shrink-0 place-items-center rounded-sm border border-line text-sm"
                aria-hidden
              >
                .eth
              </span>
              <Input {...a} {...profileForm.register('ensName')} placeholder="seunome" />
            </div>
          )}
        </Field>
        <Field id="p-walletNickname" label="Apelido da carteira" required error={pe.walletNickname?.message}>
          {(a) => <Input {...a} {...profileForm.register('walletNickname')} />}
        </Field>
        <div>
          <p className="text-sm font-medium" id="avatar-label">
            Avatar
          </p>
          <div className="mt-2 flex items-center gap-6">
            <span className="grid size-[50px] place-items-center overflow-hidden rounded-full border border-line-soft bg-surface">
              {data.avatarUrl ? (
                <img
                  src={data.avatarUrl}
                  alt="Seu avatar atual"
                  className="size-full object-cover"
                  data-testid="avatar-img"
                />
              ) : (
                <ImageIcon className="size-5 text-primary" aria-label="Sem avatar" />
              )}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              id="avatar-file"
              aria-labelledby="avatar-label"
              aria-describedby={avatarError ? 'avatar-err' : 'avatar-hint'}
              data-testid="avatar-input"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) avatar.mutate(f)
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => fileRef.current?.click()}
              loading={avatar.isPending && avatar.variables !== null}
            >
              Alterar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => avatar.mutate(null)}
              disabled={!data.avatarUrl || avatar.isPending}
            >
              Remover
            </Button>
          </div>
          {avatarError ? (
            <p id="avatar-err" role="alert" className="mt-2 text-xs text-danger">
              ⚠ {avatarError}
            </p>
          ) : (
            <p id="avatar-hint" className="mt-2 text-xs text-subtle">
              PNG, JPG, WEBP ou GIF até 1 MB.
            </p>
          )}
        </div>
      </div>

      <fieldset className="mt-10 max-w-[417px]">
        <legend className="text-base font-bold">Alterar senha</legend>
        <div className="mt-6 flex flex-col gap-6">
          <Field id="pw-current" label="Senha atual" error={we.currentPassword?.message}>
            {(a) => (
              <Input {...a} type="password" autoComplete="current-password" {...pwForm.register('currentPassword')} />
            )}
          </Field>
          <Field
            id="pw-new"
            label="Nova senha"
            error={we.newPassword?.message}
            hint="Mínimo de 8 caracteres, com letras e números."
          >
            {(a) => <Input {...a} type="password" autoComplete="new-password" {...pwForm.register('newPassword')} />}
          </Field>
          <Field id="pw-confirm" label="Confirmar nova senha" error={we.confirmPassword?.message}>
            {(a) => (
              <Input {...a} type="password" autoComplete="new-password" {...pwForm.register('confirmPassword')} />
            )}
          </Field>
        </div>
      </fieldset>
      <Button type="submit" className="mt-8 w-[131px] rounded-sm" loading={saving} data-testid="profile-save">
        Salvar
      </Button>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Carteiras                                                           */
/* ------------------------------------------------------------------ */

export function WalletsPage() {
  const user = useCurrentUser()!
  const wallets = useQuery({ queryKey: qk.wallets(user.id), queryFn: ({ signal }) => api.listWallets({ signal }) })
  const [showSecondary, setShowSecondary] = useState(false)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)

  if (wallets.isPending) return <Skeleton className="h-[500px]" />
  if (wallets.isError) return <ErrorState error={wallets.error} onRetry={() => wallets.refetch()} />
  const primary = wallets.data.find((w) => w.role === 'primary')
  const secondary = wallets.data.find((w) => w.role === 'secondary')

  return (
    <div>
      <h1 className="sr-only">Carteiras</h1>
      <WalletForm key={primary?.updatedAt ?? 'new-primary'} role="primary" wallet={primary} />

      <section aria-labelledby="secondary-title" className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="secondary-title" className="text-lg font-bold">
            Carteira secundária
          </h2>
          {!secondary && (
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sameAsPrimary}
                  onChange={(e) => setSameAsPrimary(e.target.checked)}
                  disabled={!primary}
                  className="size-4 accent-[var(--color-primary)]"
                />
                Igual à carteira principal
              </label>
              <Button
                variant="link"
                className="h-auto p-0 text-base font-bold"
                onClick={() => setShowSecondary(true)}
                aria-expanded={showSecondary}
              >
                Adicionar
              </Button>
            </div>
          )}
        </div>
        {secondary || showSecondary ? (
          <WalletForm
            key={secondary?.updatedAt ?? `new-secondary-${sameAsPrimary}`}
            role="secondary"
            wallet={secondary}
            prefill={!secondary && sameAsPrimary ? primary : undefined}
          />
        ) : (
          <p className="mt-2 text-sm text-muted">Você ainda não adicionou uma carteira secundária.</p>
        )}
      </section>
    </div>
  )
}

function WalletForm({ role, wallet, prefill }: { role: 'primary' | 'secondary'; wallet?: Wallet; prefill?: Wallet }) {
  const user = useCurrentUser()!
  const qc = useQueryClient()
  const base = wallet ?? prefill
  const form = useForm<WalletInput>({
    resolver: zodResolver(walletInputSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      role,
      displayName: base?.displayName ?? user.displayName,
      nickname: base?.nickname ?? '',
      network: base?.network,
      address: base?.address ?? '',
      secondaryAddress: base?.secondaryAddress ?? '',
      provider: base?.provider,
      profileName: base?.profileName ?? user.ensName ?? '',
      referralCode: base?.referralCode ?? '',
      email: base?.email ?? user.email,
      ensName: base?.ensName ?? user.ensName ?? '',
    } as WalletInput,
  })
  const save = useMutation({
    mutationFn: (v: WalletInput) => (wallet ? api.updateWallet(wallet.id, v) : api.createWallet(v)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.wallets(user.id) })
      toast.success(role === 'primary' ? 'Carteira principal salva' : 'Carteira secundária salva')
    },
    onError: (err) => {
      applyServerErrors(err, form.setError)
      toast.error(err.message)
    },
  })
  useEffect(() => form.setValue('role', role), [form, role])
  const e = form.formState.errors
  const p = `w-${role}`

  return (
    <form
      noValidate
      onSubmit={(ev) => {
        const el = ev.currentTarget
        void form.handleSubmit(
          (v) => save.mutate(v),
          () => {
            focusFirstInvalid(el)
            toast.error('Revise os campos destacados.')
          },
        )(ev)
      }}
      data-testid={`wallet-form-${role}`}
    >
      {role === 'primary' && (
        <div className="mb-6">
          <h2 className="text-lg font-bold">Carteira principal</h2>
          <p className="mt-1 text-xs text-muted">
            Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.
          </p>
        </div>
      )}
      <div className={cn('grid gap-x-7 gap-y-6 md:grid-cols-2', role === 'secondary' && 'mt-6')}>
        <Field id={`${p}-displayName`} label="Nome de exibição" required error={e.displayName?.message}>
          {(a) => <Input {...a} {...form.register('displayName')} />}
        </Field>
        <Field id={`${p}-nickname`} label="Apelido da carteira" required error={e.nickname?.message}>
          {(a) => <Input {...a} {...form.register('nickname')} />}
        </Field>
        <Field id={`${p}-network`} label="Rede" required error={e.network?.message}>
          {(a) => (
            <Controller
              control={form.control}
              name="network"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => field.onChange(v as Network)}>
                  <SelectTrigger {...a} onBlur={field.onBlur}>
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
        <Field id={`${p}-profileName`} label="Nome do perfil" required error={e.profileName?.message}>
          {(a) => <Input {...a} {...form.register('profileName')} />}
        </Field>
        <Field id={`${p}-address`} label="Endereço da carteira" required error={e.address?.message}>
          {(a) => (
            <Input {...a} {...form.register('address')} placeholder="Endereço 0x da carteira" spellCheck={false} />
          )}
        </Field>
        <Field
          id={`${p}-secondaryAddress`}
          label="ENS ou carteira secundária (opcional)"
          error={e.secondaryAddress?.message}
        >
          {(a) => (
            <Input {...a} {...form.register('secondaryAddress')} placeholder="ENS ou carteira secundária (opcional)" />
          )}
        </Field>
        <Field id={`${p}-provider`} label="Tipo de carteira" required error={e.provider?.message}>
          {(a) => (
            <Controller
              control={form.control}
              name="provider"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => field.onChange(v as WalletProvider)}>
                  <SelectTrigger {...a} onBlur={field.onBlur}>
                    <SelectValue placeholder="Selecione uma carteira" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(WALLET_PROVIDER_LABEL) as WalletProvider[]).map((n) => (
                      <SelectItem key={n} value={n}>
                        {WALLET_PROVIDER_LABEL[n]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Field>
        <Field id={`${p}-referralCode`} label="Código de indicação" required error={e.referralCode?.message}>
          {(a) => <Input {...a} {...form.register('referralCode')} />}
        </Field>
        <Field id={`${p}-email`} label="E-mail" required error={e.email?.message}>
          {(a) => <Input {...a} type="email" {...form.register('email')} />}
        </Field>
        <Field id={`${p}-ensName`} label="Nome ENS" required error={e.ensName?.message}>
          {(a) => (
            <div className="flex gap-2">
              <span
                className="grid h-10 w-[78px] shrink-0 place-items-center rounded-sm border border-line text-sm"
                aria-hidden
              >
                .eth
              </span>
              <Input {...a} {...form.register('ensName')} />
            </div>
          )}
        </Field>
      </div>
      {save.isError && !Object.keys(e).length && (
        <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-danger">
          <AlertTriangle className="size-4" aria-hidden /> {save.error.message}
        </p>
      )}
      <Button type="submit" className="mt-8 rounded-sm" loading={save.isPending}>
        Salvar carteira
      </Button>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Lista de interesse (favoritos)                                      */
/* ------------------------------------------------------------------ */

export function FavoritesPage() {
  const items = useFavoriteItems()
  return (
    <section aria-labelledby="fav-title">
      <h1 id="fav-title" className="text-base font-bold">
        Lista de interesse
      </h1>
      <p className="mt-1 text-xs text-muted">
        NFTs que você favoritou. Os preços e a disponibilidade são atualizados em tempo real.
      </p>
      {items.isPending ? (
        <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3" aria-busy>
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i}>
              <NftCardSkeleton />
            </li>
          ))}
        </ul>
      ) : items.isError ? (
        <div className="mt-6">
          <ErrorState error={items.error} onRetry={() => items.refetch()} retrying={items.isFetching} />
        </div>
      ) : items.data.length === 0 ? (
        <div
          className="mt-6 flex flex-col items-center gap-3 rounded-[20px] border border-line bg-surface px-6 py-12 text-center md:rounded-none"
          data-testid="favorites-empty"
        >
          <p className="text-lg font-bold">Sua lista de interesse está vazia</p>
          <p className="max-w-sm text-sm text-muted">Toque no coração de um NFT para guardá-lo aqui.</p>
          <Button asChild>
            <Link to="/mercado">Explorar NFTs</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3" data-testid="favorites-grid">
          {items.data.map((nft) => (
            <li key={nft.id}>
              <NftCard nft={nft} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
