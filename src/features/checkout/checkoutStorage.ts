/**
 * Persistência do checkout em sessionStorage:
 *  - rascunho do formulário (retomada após expiração de sessão/refresh);
 *  - tentativa em andamento (chave de idempotência + pedido pendente) para recuperar
 *    o MESMO pedido após timeout, refresh ou reconexão.
 * Escopado por usuário para não vazar entre contas.
 */
import type { CreateOrderInput } from '@/api/contracts'

const DRAFT = 'kurio:checkout:draft'
const ATTEMPT = 'kurio:checkout:attempt'

export interface CheckoutAttempt {
  userId: string
  key: string
  input: CreateOrderInput
  orderId: string | null
  createdAt: string
}

function safeGet<T>(k: string): T | null {
  try {
    const raw = sessionStorage.getItem(k)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export const checkoutStorage = {
  getDraft<T>(userId: string): T | null {
    const d = safeGet<{ userId: string; values: T }>(DRAFT)
    return d && d.userId === userId ? d.values : null
  },
  saveDraft<T>(userId: string, values: T) {
    sessionStorage.setItem(DRAFT, JSON.stringify({ userId, values }))
  },
  getAttempt(userId: string): CheckoutAttempt | null {
    const a = safeGet<CheckoutAttempt>(ATTEMPT)
    return a && a.userId === userId ? a : null
  },
  saveAttempt(a: CheckoutAttempt) {
    sessionStorage.setItem(ATTEMPT, JSON.stringify(a))
  },
  clearAttempt() {
    sessionStorage.removeItem(ATTEMPT)
  },
}

export function clearCheckoutDrafts() {
  sessionStorage.removeItem(DRAFT)
  sessionStorage.removeItem(ATTEMPT)
}
