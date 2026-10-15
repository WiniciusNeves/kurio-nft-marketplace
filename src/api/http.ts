import axios from 'axios'
import { sessionStore } from '@/features/auth/sessionStore'
import { toApiError } from './errors'
import { guestCartId } from './guestCart'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  // Configurável para testes/ambientes lentos; padrão 10 s.
  timeout: Number(import.meta.env.VITE_HTTP_TIMEOUT_MS) || 10_000,
  headers: { Accept: 'application/json' },
})

http.interceptors.request.use((config) => {
  const token = sessionStore.token()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  config.headers.set('X-Cart-Id', guestCartId())
  return config
})

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const apiErr = toApiError(err)
    const sentToken = Boolean(err?.config?.headers?.Authorization)
    // Sessão inválida/expirada durante a navegação: limpa a sessão local e deixa a UI conduzir o relogin.
    if (
      sentToken &&
      apiErr.status === 401 &&
      (apiErr.code === 'SESSION_EXPIRED' || apiErr.code === 'UNAUTHENTICATED')
    ) {
      sessionStore.expire()
    }
    return Promise.reject(apiErr)
  },
)
