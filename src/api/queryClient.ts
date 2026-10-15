import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError, toApiError } from './errors'

/**
 * Política de cache / retry (documentada em ARCHITECTURE.md):
 * - staleTime 30 s: catálogo e detalhe são "quase estáticos"; tempo real cobre mudanças.
 * - retry: até 2 tentativas apenas para falhas transitórias (rede, timeout, 5xx). 4xx nunca.
 * - mutations: sem retry automático (operações não idempotentes). O pedido tem retry
 *   próprio com a MESMA chave de idempotência.
 * - refetchOnWindowFocus: ligado apenas para dados privados críticos (definido por query).
 */
export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache(),
    mutationCache: new MutationCache(),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const e = error instanceof ApiError ? error : toApiError(error)
          return e.isTransient && failureCount < 2
        },
        retryDelay: (attempt) => Math.min(400 * 2 ** attempt, 3000),
      },
      mutations: { retry: false },
    },
  })
}
