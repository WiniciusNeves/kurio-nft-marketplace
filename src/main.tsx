import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

async function bootstrap() {
  // Mocks ativados por configuração (dev, demo publicada e testes E2E).
  // Precisam iniciar ANTES de carregar o app: o engine.io-client captura
  // `globalThis.WebSocket` no carregamento do módulo, e o MSW o substitui ao iniciar.
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'false') {
    const { startMocks } = await import('@/mocks/browser')
    await startMocks()
  }
  const { App } = await import('@/app/App')
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
