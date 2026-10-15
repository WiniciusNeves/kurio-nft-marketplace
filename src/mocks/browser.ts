/**
 * Inicialização da camada de mocks no navegador (dev, demo publicada e testes E2E).
 * Ativada por padrão (desligue com VITE_ENABLE_MOCKS=false) — não existe nenhum caminho alternativo de negócio fora daqui.
 */
import { setupWorker } from 'msw/browser'
import { loadConfig, shouldResetFromUrl } from './config'
import { initDb } from './db'
import { handlers } from './handlers'
import { resumePendingOrders } from './orders'

export async function startMocks() {
  loadConfig()
  await initDb({ reset: shouldResetFromUrl() })
  resumePendingOrders()

  const worker = setupWorker(...handlers)
  await worker.start({
    onUnhandledRequest(request, print) {
      const url = new URL(request.url)
      // Assets estáticos e fontes passam direto.
      if (url.origin === location.origin && !url.pathname.startsWith('/api')) return
      print.warning()
    },
    quiet: import.meta.env.PROD,
    serviceWorker: { url: '/mockServiceWorker.js' },
  })

  if (shouldResetFromUrl()) {
    const url = new URL(location.href)
    url.searchParams.delete('mock-reset')
    history.replaceState(history.state, '', url)
  }
  return worker
}
