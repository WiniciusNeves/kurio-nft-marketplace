import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { sessionStore } from '@/features/auth/sessionStore'
import { catalogSearchSchema } from '@/features/catalog/searchSchema'
import { HomePage, MarketPage } from '@/pages/HomePage'
import { ComingSoonPage, NotFoundPage } from '@/pages/MiscPages'

// Code splitting por rota: a página inicial (LCP) fica no bundle principal; o resto carrega sob demanda.
const NftDetailPage = lazyRouteComponent(() => import('@/pages/NftDetailPage'), 'NftDetailPage')
const CartPage = lazyRouteComponent(() => import('@/pages/CartPage'), 'CartPage')
const CheckoutPage = lazyRouteComponent(() => import('@/pages/CheckoutPage'), 'CheckoutPage')
const OrderPage = lazyRouteComponent(() => import('@/pages/OrderPage'), 'OrderPage')
const LoginPage = lazyRouteComponent(() => import('@/pages/AuthPages'), 'LoginPage')
const RegisterPage = lazyRouteComponent(() => import('@/pages/AuthPages'), 'RegisterPage')
const AccountLayout = lazyRouteComponent(() => import('@/pages/AccountPages'), 'AccountLayout')
const ProfilePage = lazyRouteComponent(() => import('@/pages/AccountPages'), 'ProfilePage')
const WalletsPage = lazyRouteComponent(() => import('@/pages/AccountPages'), 'WalletsPage')
const FavoritesPage = lazyRouteComponent(() => import('@/pages/AccountPages'), 'FavoritesPage')
import { RootLayout, RootError } from './RootLayout'
import { Protected } from './Protected'

/** Proteção de rotas privadas: sem sessão, vai para o login preservando o destino. */
function requireAuth({ location }: { location: { href: string } }) {
  const s = sessionStore.get()
  // Expiração conhecida localmente (expiresAt) também é tratada na navegação.
  if (s.status === 'authenticated' && Date.parse(s.session.expiresAt) <= Date.now()) {
    sessionStore.expire()
    throw redirect({ to: '/login', search: { redirect: location.href, reason: 'expired' } })
  }
  if (sessionStore.get().status !== 'authenticated') {
    throw redirect({ to: '/login', search: { redirect: location.href } })
  }
}

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: RootError,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: catalogSearchSchema,
  component: HomePage,
})
const marketRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mercado',
  validateSearch: catalogSearchSchema,
  component: MarketPage,
})
const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$nftId',
  validateSearch: z.object({ edicao: z.string().optional().catch(undefined) }),
  component: NftDetailPage,
})
const cartRoute = createRoute({ getParentRoute: () => rootRoute, path: '/cart', component: CartPage })
const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/checkout',
  beforeLoad: requireAuth,
  component: () => (
    <Protected>
      <CheckoutPage />
    </Protected>
  ),
})
const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders/$orderId',
  beforeLoad: requireAuth,
  component: () => (
    <Protected>
      <OrderPage />
    </Protected>
  ),
})

const authSearch = z.object({
  redirect: z.string().optional().catch(undefined),
  reason: z.enum(['expired']).optional().catch(undefined),
})
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: authSearch,
  component: LoginPage,
})
const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  validateSearch: authSearch,
  component: RegisterPage,
})

const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/account',
  beforeLoad: requireAuth,
  component: () => (
    <Protected>
      <AccountLayout />
    </Protected>
  ),
})
const accountIndex = createRoute({
  getParentRoute: () => accountRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/account/profile' })
  },
})
const profileRoute = createRoute({ getParentRoute: () => accountRoute, path: '/profile', component: ProfilePage })
const walletsRoute = createRoute({ getParentRoute: () => accountRoute, path: '/wallets', component: WalletsPage })
const favoritesRoute = createRoute({ getParentRoute: () => accountRoute, path: '/favorites', component: FavoritesPage })

const soonRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/em-breve',
  validateSearch: z.object({ secao: z.string().optional().catch(undefined) }),
  component: ComingSoonPage,
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  marketRoute,
  nftRoute,
  cartRoute,
  checkoutRoute,
  orderRoute,
  loginRoute,
  registerRoute,
  accountRoute.addChildren([accountIndex, profileRoute, walletsRoute, favoritesRoute]),
  soonRoute,
])

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    scrollRestoration: true,
    defaultNotFoundComponent: NotFoundPage,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
