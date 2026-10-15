import { isAxiosError } from 'axios'
import { apiErrorBodySchema, type ErrorCode } from './contracts'

/** Erro normalizado da API — tudo que a UI precisa para decidir feedback e recuperação. */
export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'CANCELED' | 'BAD_RESPONSE'
  readonly fieldErrors: Record<string, string>
  readonly details: unknown

  constructor(init: {
    status: number
    code: ApiError['code']
    message: string
    fieldErrors?: Record<string, string>
    details?: unknown
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.fieldErrors = init.fieldErrors ?? {}
    this.details = init.details
  }

  /** Falhas em que repetir a mesma operação faz sentido. */
  get isTransient() {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT' || this.status >= 500
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  if (isAxiosError(err)) {
    if (err.code === 'ERR_CANCELED')
      return new ApiError({ status: 0, code: 'CANCELED', message: 'Requisição cancelada.' })
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT')
      return new ApiError({ status: 0, code: 'TIMEOUT', message: 'O servidor demorou para responder.' })
    if (!err.response)
      return new ApiError({
        status: 0,
        code: 'NETWORK_ERROR',
        message: 'Sem conexão com o servidor. Verifique sua rede.',
      })
    const parsed = apiErrorBodySchema.safeParse(err.response.data)
    if (parsed.success) {
      const e = parsed.data.error
      return new ApiError({
        status: err.response.status,
        code: e.code,
        message: e.message,
        fieldErrors: e.fieldErrors,
        details: e.details,
      })
    }
    return new ApiError({
      status: err.response.status,
      code: 'INTERNAL_ERROR',
      message: 'Erro inesperado do servidor.',
    })
  }
  if (err && typeof err === 'object' && 'issues' in err)
    return new ApiError({ status: 0, code: 'BAD_RESPONSE', message: 'Resposta da API fora do contrato.' })
  return new ApiError({
    status: 0,
    code: 'INTERNAL_ERROR',
    message: err instanceof Error ? err.message : 'Erro inesperado.',
  })
}
