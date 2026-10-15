/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_MOCKS?: string
  readonly VITE_API_URL?: string
  readonly VITE_SOCKET_URL?: string
  readonly VITE_MOCK_SCENARIO?: string
  readonly VITE_SHOW_MOCK_PANEL?: string
  readonly VITE_HTTP_TIMEOUT_MS?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
