import { useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Toaster, toast } from 'sonner'
import { api } from '@/api/endpoints'
import { qk } from '@/api/queryKeys'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { sessionStore } from '@/features/auth/sessionStore'
import { useSessionState } from '@/features/auth/useSession'
import { MockPanel } from '@/features/devtools/MockPanel'
import { realtime } from '@/realtime/realtime'

/** Esconde o cabeçalho desktop nas telas que no Figma mobile têm barra própria. */
const OWN_MOBILE_TOP = /^\/($|mercado|nft\/|cart|checkout|login|register)/
/** Telas cujo frame mobile não tem a barra inferior (têm barra de ação própria). */
const NO_TAB_BAR = /^\/(nft\/|cart|checkout|orders|login|register)/

export function RootLayout() {
  const { pathname } = useLocation()
  useSessionLifecycle()
  return (
    <>
      <div className={OWN_MOBILE_TOP.test(pathname) ? 'hidden md:block' : ''}>
        <Header />
      </div>
      <main id="conteudo" tabIndex={-1} className="min-h-[100dvh] pt-4 focus:outline-none md:pt-0">
        <Outlet />
      </main>
      <div className={NO_TAB_BAR.test(pathname) ? '' : 'pb-[120px] md:pb-0'}>
        <Footer />
      </div>
      {!NO_TAB_BAR.test(pathname) && <MobileTabBar />}
      <Toaster
        theme="dark"
        position="top-center"
        richColors
        closeButton
        toastOptions={{ classNames: { toast: 'font-sans' } }}
        containerAriaLabel="Notificações"
      />
      {import.meta.env.VITE_SHOW_MOCK_PANEL !== 'false' && <MockPanel />}
    </>
  )
}

/**
 * Ciclo de vida da sessão:
 *  - valida a sessão restaurada após refresh (GET /auth/session);
 *  - recria o socket a cada troca de token (libera listeners da sessão anterior);
 *  - ao expirar: limpa dados privados e leva ao login preservando o destino.
 */
function useSessionLifecycle() {
  const qc = useQueryClient()
  const state = useSessionState()
  const navigate = useNavigate()
  const { href, pathname } = useLocation()
  const token = state.status === 'authenticated' ? state.session.token : null
  const userId = state.status === 'authenticated' ? state.session.user.id : null
  const hrefRef = useRef(href)
  hrefRef.current = href
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  useQuery({
    queryKey: ['session', token],
    queryFn: async ({ signal }) => {
      const s = await api.session({ signal })
      sessionStore.updateUser(s.user)
      return s
    },
    enabled: Boolean(token),
    staleTime: 60_000,
    retry: false,
  })

  useEffect(() => {
    realtime.start(qc, { token, userId })
    return () => realtime.stop()
  }, [qc, token, userId])

  useEffect(() => {
    if (state.status !== 'expired') return
    qc.removeQueries({ queryKey: qk.userAll })
    qc.removeQueries({ queryKey: qk.cartAll })
    toast.warning('Sua sessão expirou. Entre novamente para continuar.')
    if (!pathnameRef.current.startsWith('/login')) {
      void navigate({ to: '/login', search: { redirect: hrefRef.current, reason: 'expired' }, replace: true })
    }
  }, [state.status, qc, navigate])

  // Foco no conteúdo a cada navegação (leitores de tela anunciam a nova página).
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    document.getElementById('conteudo')?.focus({ preventScroll: true })
  }, [pathname])
}

/** Erro inesperado de renderização/rota — nunca deixa a tela em branco. */
export function RootError({ error, reset }: { error: unknown; reset: () => void }) {
  return (
    <div className="container-page flex flex-col items-center gap-4 py-24 text-center" role="alert">
      <h1 className="text-2xl font-bold">Algo deu errado</h1>
      <p className="max-w-md text-sm text-muted">{error instanceof Error ? error.message : 'Erro inesperado.'}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-primary px-6 py-2 font-bold text-primary-foreground"
      >
        Tentar novamente
      </button>
    </div>
  )
}
