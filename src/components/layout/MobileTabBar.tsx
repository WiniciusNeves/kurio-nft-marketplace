import { Link, useLocation } from '@tanstack/react-router'
import { useCart } from '@/features/cart/useCart'
import { useCurrentUser } from '@/features/auth/useSession'
import { cn } from '@/lib/utils'

/* Ícones "Iconly Bold" do Figma (preenchidos), redesenhados em SVG. */
const HomeIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
    <path d="M9.14 20.77v-3.06c0-.78.64-1.41 1.42-1.41h2.87c.38 0 .74.15 1 .41.27.27.42.63.42 1v3.06c0 .33.13.64.36.87.23.23.55.36.88.36h1.96c.91 0 1.79-.36 2.44-1A3.43 3.43 0 0 0 21.5 18.6V9.9c0-.73-.33-1.43-.9-1.9l-6.65-5.28a3.1 3.1 0 0 0-3.95.07L3.5 8a2.48 2.48 0 0 0-1 1.9v8.69A3.43 3.43 0 0 0 5.94 22h1.92c.68 0 1.24-.55 1.25-1.23Z" />
  </svg>
)
const HeartIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
    <path d="M16.28 3.5c.63 0 1.26.09 1.86.29 3.69 1.2 5.02 5.25 3.91 8.79a12.8 12.8 0 0 1-3.03 4.84 38.7 38.7 0 0 1-6.37 4.99l-.25.15-.26-.16a38.4 38.4 0 0 1-6.4-4.99 12.95 12.95 0 0 1-3.03-4.83C1.58 9.04 2.91 4.99 6.64 3.78c.29-.1.59-.17.89-.2h.12c.28-.04.56-.06.84-.06h.11c.63.02 1.24.13 1.83.33h.06c.04.02.07.04.09.06.22.07.43.15.63.26l.38.17c.09.05.19.12.28.17.06.04.11.08.16.11a6.1 6.1 0 0 1 3.75-1.28Z" />
  </svg>
)
const CartIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
    <path d="M7.42 19.82a1.53 1.53 0 1 1 0 3.06 1.53 1.53 0 0 1 0-3.06Zm11.25 0a1.53 1.53 0 1 1 0 3.06 1.53 1.53 0 0 1 0-3.06ZM1.91 1.5l2.39.36c.34.07.6.35.63.7l.19 2.27c.03.32.29.56.61.56H20.6c.63 0 1.05.21 1.46.69.41.48.48 1.17.39 1.79l-.95 6.56a2.63 2.63 0 0 1-2.6 2.25H7.98a2.62 2.62 0 0 1-2.61-2.41l-.92-10.9-1.5-.26a.75.75 0 1 1 .24-1.48Zm14.5 7.4h-2.77a.75.75 0 0 0 0 1.5h2.77a.75.75 0 1 0 0-1.5Z" />
  </svg>
)
const UserIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
    <path d="M12 15.17c-4.31 0-8 .68-8 3.4C4 21.3 7.66 22 12 22c4.31 0 8-.68 8-3.4 0-2.72-3.67-3.43-8-3.43ZM12 12.58a5.3 5.3 0 0 0 5.29-5.29A5.3 5.3 0 0 0 12 2a5.3 5.3 0 0 0-5.29 5.29A5.27 5.27 0 0 0 12 12.58Z" />
  </svg>
)
const ScanIcon = () => (
  <svg
    viewBox="0 0 28 24"
    width="28"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M2 8V6a5 5 0 0 1 5-5h2M19 1h2a5 5 0 0 1 5 5v2M26 16v2a5 5 0 0 1-5 5h-2M9 23H7a5 5 0 0 1-5-5v-2M1 12h26" />
  </svg>
)

/**
 * Barra inferior do Figma (Mobile / Início › Tab Bar):
 * duas abas com cantos arredondados, "recorte" central e botão circular em gradiente.
 */
export function MobileTabBar() {
  const { pathname, href } = useLocation()
  const user = useCurrentUser()
  const cart = useCart()
  const count = cart.data?.itemCount ?? 0
  const item = (active: boolean) =>
    cn(
      'relative grid size-12 place-items-center rounded-full transition-colors',
      active ? 'text-primary-strong' : 'text-muted hover:text-foreground',
    )

  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed inset-x-0 bottom-0 z-40 md:hidden"
      data-testid="mobile-tab-bar"
    >
      <div className="relative h-[116px]">
        {/*
          Fundo fiel ao frame "Tab Bar" do Figma: uma barra única com recorte côncavo central
          (curva em "S") onde se encaixa o botão circular. O recorte é preenchido com a cor de
          fundo, então o conteúdo da página nunca aparece pelo vão.
        */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[84px] drop-shadow-[0_-6px_16px_rgba(0,0,0,0.35)]"
        >
          <div className="flex-1 rounded-tl-[36px] bg-surface" />
          <svg width="180" height="84" viewBox="0 0 180 84" className="shrink-0" aria-hidden>
            <rect width="180" height="84" className="fill-transparent" />
            <path
              className="fill-surface"
              d="M0 0H16C33 0 39 9 45 19C54 36 70 47 90 47C110 47 126 36 135 19C141 9 147 0 164 0H180V84H0Z"
            />
          </svg>
          <div className="flex-1 rounded-tr-[36px] bg-surface" />
        </div>

        <ul className="pb-[env(safe-area-inset-bottom)]">
          <li className="absolute bottom-[20px] left-[22px]">
            <Link
              to="/"
              className={item(pathname === '/')}
              aria-label="Início"
              aria-current={pathname === '/' ? 'page' : undefined}
            >
              <HomeIcon />
            </Link>
          </li>
          <li className="absolute bottom-[20px] left-[94px]">
            <Link
              to={user ? '/account/favorites' : '/login'}
              search={user ? undefined : { redirect: '/account/favorites' }}
              className={item(pathname === '/account/favorites')}
              aria-label="Lista de interesse (favoritos)"
              aria-current={pathname === '/account/favorites' ? 'page' : undefined}
            >
              <HeartIcon />
            </Link>
          </li>
          <li className="absolute right-[88px] bottom-[20px]">
            <Link
              to="/cart"
              className={item(pathname === '/cart')}
              aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
            >
              <CartIcon />
              {count > 0 && (
                <span
                  className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
                  aria-hidden
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
          </li>
          <li className="absolute right-[26px] bottom-[20px]">
            <Link
              to={user ? '/account/profile' : '/login'}
              search={user ? undefined : { redirect: href }}
              className={item(pathname.startsWith('/account') && pathname !== '/account/favorites')}
              aria-label={user ? 'Minha conta' : 'Entrar'}
              aria-current={pathname.startsWith('/account') && pathname !== '/account/favorites' ? 'page' : undefined}
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="size-6 rounded-full object-cover" />
              ) : (
                <UserIcon />
              )}
            </Link>
          </li>
        </ul>

        <Link
          to="/mercado"
          className="absolute top-0 left-1/2 grid size-[65px] -translate-x-1/2 place-items-center rounded-full bg-gradient-to-br from-[#e1a066] to-[#b8743c] text-foreground shadow-lg shadow-black/40"
          aria-label="Explorar mercado"
          aria-current={pathname === '/mercado' ? 'page' : undefined}
        >
          <ScanIcon />
        </Link>
      </div>
    </nav>
  )
}
