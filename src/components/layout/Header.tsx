import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { LogIn, Menu, Search, ShoppingCart, User as UserIcon, X } from 'lucide-react'
import { Dialog, DialogTitle, SheetContent, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useCart } from '@/features/cart/useCart'
import { useCurrentUser } from '@/features/auth/useSession'
import { RealtimeIndicator } from '@/realtime/RealtimeIndicator'
import { cn } from '@/lib/utils'

const NAV = [
  { label: 'Início', to: '/', match: (p: string) => p === '/' },
  { label: 'Mercado', to: '/mercado', match: (p: string) => /^\/(mercado|nft|cart|checkout|orders)/.test(p) },
  { label: 'Criadores', to: '/em-breve', search: { secao: 'criadores' }, match: () => false },
  { label: 'Aprenda', to: '/em-breve', search: { secao: 'aprenda' }, match: () => false },
] as const

export function Header() {
  const { pathname, href } = useLocation()
  const user = useCurrentUser()
  const cart = useCart()
  const count = cart.data?.itemCount ?? 0
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => setMenuOpen(false), [pathname])

  return (
    <header className="container-page">
      <a
        href="#conteudo"
        className="sr-only z-50 bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      <div className="flex h-[68px] items-center justify-between gap-4 border-b border-line">
        <div className="flex items-center gap-2">
          <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
            <button
              type="button"
              className="-ml-2 rounded-sm p-2 text-foreground lg:hidden"
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="size-6" aria-hidden />
            </button>
            <SheetContent side="left" aria-describedby={undefined}>
              <DialogTitle className="mb-6 text-sm font-bold tracking-[0.2em]">KURIO</DialogTitle>
              <nav aria-label="Principal (mobile)">
                <ul className="flex flex-col gap-1">
                  {NAV.map((n) => (
                    <li key={n.label}>
                      <Link
                        to={n.to}
                        search={'search' in n ? n.search : undefined}
                        className={cn(
                          'block rounded-sm px-3 py-3 text-base',
                          n.match(pathname) ? 'bg-surface-2 font-bold text-primary-strong' : 'text-foreground',
                        )}
                        aria-current={n.match(pathname) ? 'page' : undefined}
                      >
                        {n.label}
                      </Link>
                    </li>
                  ))}
                  <li className="mt-4 border-t border-line pt-4">
                    {user ? (
                      <Link to="/account/profile" className="block px-3 py-3 text-primary">
                        Minha conta
                      </Link>
                    ) : (
                      <Link to="/login" search={{ redirect: href }} className="block px-3 py-3 text-primary">
                        Entrar ou criar conta
                      </Link>
                    )}
                  </li>
                </ul>
              </nav>
            </SheetContent>
          </Dialog>
          <Link
            to="/"
            className="text-sm font-bold tracking-[0.2em] text-foreground"
            aria-label="Kurio — página inicial"
          >
            KURIO
          </Link>
        </div>

        <nav aria-label="Principal" className="hidden h-full lg:block">
          <ul className="flex h-full items-center gap-10">
            {NAV.map((n) => {
              const active = n.match(pathname)
              return (
                <li key={n.label} className="h-full">
                  <Link
                    to={n.to}
                    search={'search' in n ? n.search : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-full items-center border-b-[3px] pt-1 text-base transition-colors',
                      active
                        ? 'border-primary font-bold text-primary-strong'
                        : 'border-transparent text-foreground hover:text-primary-strong',
                    )}
                  >
                    {n.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-3 md:gap-5">
          <RealtimeIndicator />
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="rounded-sm p-1.5 text-foreground hover:text-primary-strong"
            aria-label="Buscar NFTs"
          >
            <Search className="size-6" aria-hidden />
          </button>
          <Link
            to="/cart"
            className="relative rounded-sm p-1.5 text-foreground hover:text-primary-strong"
            aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
          >
            <ShoppingCart className="size-6" aria-hidden />
            {count > 0 && (
              <span
                className="absolute -top-0.5 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
                aria-hidden
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
          {user ? (
            <Link
              to="/account/profile"
              className="flex items-center gap-2 rounded-md border border-primary px-2 py-1.5 text-sm text-primary hover:bg-primary/10 md:px-3"
              aria-label={`Minha conta (${user.displayName})`}
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="size-6 rounded-full object-cover" />
              ) : (
                <UserIcon className="size-5" aria-hidden />
              )}
              <span className="hidden max-w-28 truncate md:inline">{user.displayName}</span>
            </Link>
          ) : (
            <Link
              to="/login"
              search={{ redirect: href }}
              className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-base font-medium text-primary-foreground hover:bg-primary-strong"
            >
              <LogIn className="size-5" aria-hidden />
              <span className="hidden sm:inline">Entrar</span>
              <span className="sr-only sm:hidden">Entrar</span>
            </Link>
          )}
        </div>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  )
}

function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="inset-y-auto top-0 h-auto max-h-none w-full max-w-none border-b-4 border-l-0 border-primary"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <DialogTitle className="mb-1 text-base font-bold">Buscar NFTs</DialogTitle>
        <DialogDescription className="mb-4 text-sm text-muted">Busque por nome, coleção ou criador.</DialogDescription>
        <form
          role="search"
          className="container-page flex gap-2 px-0"
          onSubmit={(e) => {
            e.preventDefault()
            onOpenChange(false)
            void navigate({
              to: '/mercado',
              search: (prev: Record<string, unknown>) => ({ ...prev, q: value.trim() || undefined, page: undefined }),
            })
          }}
        >
          <label htmlFor="global-search" className="sr-only">
            Termo de busca
          </label>
          <Input
            id="global-search"
            ref={inputRef}
            type="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ex.: Emerald Ape"
            autoComplete="off"
          />
          <button type="submit" className="rounded-md bg-primary px-4 font-bold text-primary-foreground">
            Buscar
          </button>
          <button type="button" className="sr-only" onClick={() => onOpenChange(false)}>
            <X /> Fechar busca
          </button>
        </form>
      </SheetContent>
    </Dialog>
  )
}
