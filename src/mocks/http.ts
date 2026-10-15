/**
 * Utilitários compartilhados pelos handlers MSW:
 * condições de rede por cenário, respostas de erro padronizadas e autenticação.
 */
import { HttpResponse, delay } from 'msw'
import type { ApiErrorBody, ErrorCode } from '@/api/contracts'
import { getConfig } from './config'
import { db, save } from './db'

export const API = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
export const api = (path: string) => `${API}${path}`

let requestSeq = 0
const firstAttempt = new Set<string>()

export function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  extra: { fieldErrors?: Record<string, string>; details?: unknown } = {},
) {
  const body: ApiErrorBody = { error: { code, message, ...extra } }
  return HttpResponse.json(body, { status })
}

type RouteKind = 'catalog' | 'detail' | 'private' | 'favorites-mutation' | 'public'

/**
 * Aplica latência e falhas do cenário ativo. Retorna uma Response quando a
 * requisição deve falhar, ou `undefined` para seguir com o handler.
 */
export async function applyNetwork(request: Request, kind: RouteKind): Promise<Response | undefined> {
  const cfg = getConfig()
  const seq = ++requestSeq
  const url = new URL(request.url)
  const routeKey = `${request.method} ${url.pathname}`

  if (cfg.latency === 'auto') {
    switch (cfg.scenario) {
      case 'slow':
        await delay(2500)
        break
      case 'variable-latency':
        await delay(200 + ((seq * 7919) % 1800))
        break
      case 'out-of-order':
        // Requisições do catálogo alternam lenta/rápida: a anterior chega depois da seguinte.
        await delay(kind === 'catalog' ? (seq % 2 === 1 ? 1600 : 150) : 150)
        break
      default:
        await delay(120 + ((seq * 37) % 180))
    }
  }

  switch (cfg.scenario) {
    case 'offline':
      return HttpResponse.error()
    case 'timeout':
      // A 1ª chamada de cada rota do catálogo/detalhe "trava" além do timeout do Axios (10 s).
      // O cliente aborta, exibe o estado de carregamento/erro e a nova tentativa recebe resposta.
      if ((kind === 'catalog' || kind === 'detail') && !firstAttempt.has(routeKey)) {
        firstAttempt.add(routeKey)
        await delay(30_000)
        return HttpResponse.error()
      }
      break
    case 'server-error':
      if (kind === 'catalog' || kind === 'detail')
        return errorResponse(500, 'INTERNAL_ERROR', 'Erro interno ao consultar o catálogo.')
      break
    case 'flaky':
      if (!firstAttempt.has(routeKey)) {
        firstAttempt.add(routeKey)
        return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Serviço temporariamente indisponível. Tente novamente.')
      }
      break
    case 'unauthorized':
      if (kind === 'private')
        return errorResponse(403, 'FORBIDDEN', 'Você não tem permissão para acessar este recurso.')
      break
    case 'favorites-fail':
      if (kind === 'favorites-mutation')
        return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Não foi possível atualizar seus favoritos agora.')
      break
  }
  return undefined
}

export function resetNetworkCounters() {
  requestSeq = 0
  firstAttempt.clear()
}

/** Resolve a sessão do header Authorization. */
export function sessionFrom(request: Request) {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return { status: 'anonymous' as const }
  return resolveToken(token)
}

export function resolveToken(token: string) {
  const s = db().sessions.find((x) => x.token === token)
  if (!s || s.revoked) return { status: 'invalid' as const }
  if (new Date(s.expiresAt).getTime() <= Date.now()) return { status: 'expired' as const }
  const user = db().users.find((u) => u.id === s.userId)
  if (!user) return { status: 'invalid' as const }
  return { status: 'ok' as const, session: s, user }
}

/** Exige sessão válida; devolve o usuário ou uma Response 401. */
export function requireUser(request: Request) {
  const r = sessionFrom(request)
  if (r.status === 'ok') return { user: r.user, session: r.session }
  if (r.status === 'expired')
    return { response: errorResponse(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.') }
  return { response: errorResponse(401, 'UNAUTHENTICATED', 'Faça login para continuar.') }
}

export function expireAllSessions() {
  db().sessions.forEach((s) => {
    s.expiresAt = new Date(Date.now() - 1000).toISOString()
  })
  save()
}

export async function readJson<T = unknown>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}
