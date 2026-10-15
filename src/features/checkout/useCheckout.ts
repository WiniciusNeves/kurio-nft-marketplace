/**
 * Orquestra cotação, revisão e criação idempotente do pedido.
 *
 *  1. `requestQuote(network)`  -> POST /quote (snapshot de preço, cupom, taxa e total)
 *  2. usuário revisa e confirma -> POST /orders com Idempotency-Key
 *  3. timeout/erro de rede      -> reenvia com a MESMA chave (recupera o mesmo pedido)
 *  4. QUOTE_CHANGED/AVAILABILITY_CONFLICT -> nova cotação; exige nova confirmação (nova chave)
 *  5. nft.updated em item da cotação -> cotação marcada como desatualizada; confirmação bloqueada
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { quoteSchema, type Buyer, type Network, type Order, type Quote } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { ApiError, toApiError } from '@/api/errors'
import { qk } from '@/api/queryKeys'
import { realtime } from '@/realtime/realtime'
import { checkoutStorage, type CheckoutAttempt } from './checkoutStorage'

export type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting'; attempt: number }
  | { status: 'recovering'; attempt: number }
  | { status: 'error'; error: ApiError }

const MAX_AUTO_RETRIES = 3

export function useCheckout(userId: string) {
  const qc = useQueryClient()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [previousQuote, setPreviousQuote] = useState<Quote | null>(null)
  const [quoteStale, setQuoteStale] = useState(false)
  const [quoting, setQuoting] = useState(false)
  const [quoteError, setQuoteError] = useState<ApiError | null>(null)
  const [submit, setSubmit] = useState<SubmitState>({ status: 'idle' })
  const inFlight = useRef(false)

  const quoteRef = useRef<Quote | null>(null)

  const replaceQuote = useCallback(
    (newQuote: Quote | null, { clearPrevious = false }: { clearPrevious?: boolean }) => {
      const old = quoteRef.current
      if (old && newQuote && old.fingerprint !== newQuote.fingerprint) setPreviousQuote(old)
      quoteRef.current = newQuote
      setQuote(newQuote)
      if (clearPrevious) setPreviousQuote(null)
    },
    [setQuote, setPreviousQuote],
  )

  // Qualquer mudança de preço/disponibilidade em um item cotado invalida a cotação atual.
  useEffect(
    () =>
      realtime.onNftUpdated((e) => {
        if (quoteRef.current?.lines.some((l) => l.nftId === e.payload.nftId)) {
          setQuoteStale(true)
        }
      }),
    [],
  )

  const requestQuote = useCallback(
    async (network: Network): Promise<Quote | null> => {
      setQuoting(true)
      setQuoteError(null)
      try {
        const q = await api.quote(network)
        replaceQuote(q, {})
        setQuoteStale(false)
        return q
      } catch (err) {
        setQuoteError(toApiError(err))
        return null
      } finally {
        setQuoting(false)
      }
    },
    [replaceQuote],
  )

  const clearQuote = useCallback(() => {
    setQuote(null)
    setPreviousQuote(null)
    setQuoteStale(false)
    quoteRef.current = null
  }, [])

  /** Envia (ou reenvia) uma tentativa. Nunca cria duas tentativas simultâneas. */
  const sendAttempt = useCallback(
    async (attempt: CheckoutAttempt): Promise<Order | null> => {
      if (inFlight.current) return null
      inFlight.current = true
      try {
        for (let i = 0; i <= MAX_AUTO_RETRIES; i++) {
          setSubmit({ status: i === 0 ? 'submitting' : 'recovering', attempt: i + 1 })
          try {
            const order = await api.createOrder(attempt.input, attempt.key)
            checkoutStorage.saveAttempt({ ...attempt, orderId: order.id })
            qc.setQueryData(qk.order(userId, order.id), order)
            setSubmit({ status: 'idle' })
            return order
          } catch (err) {
            const e = toApiError(err)
            // Falha de rede/timeout/5xx: o pedido PODE ter sido criado — reenvia com a mesma chave.
            if (e.isTransient && i < MAX_AUTO_RETRIES) {
              await new Promise((r) => setTimeout(r, 600 * 2 ** i))
              continue
            }
            if (e.code === 'QUOTE_CHANGED' || e.code === 'AVAILABILITY_CONFLICT' || e.code === 'QUOTE_EXPIRED') {
              // Tentativa encerrada sem pedido: a próxima confirmação usa nova chave.
              checkoutStorage.clearAttempt()
              const fresh = quoteSchema.safeParse((e.details as { quote?: unknown } | undefined)?.quote)
              if (fresh.success) {
                replaceQuote(fresh.data, {})
                setQuoteStale(false)
              } else {
                setQuoteStale(true)
              }
              void qc.invalidateQueries({ queryKey: qk.cartAll })
            }
            if (!e.isTransient && e.code !== 'SESSION_EXPIRED' && e.code !== 'UNAUTHENTICATED') {
              if (e.code !== 'IDEMPOTENCY_CONFLICT') checkoutStorage.clearAttempt()
            }
            setSubmit({ status: 'error', error: e })
            return null
          }
        }
        return null
      } finally {
        inFlight.current = false
      }
    },
    [qc, replaceQuote, userId],
  )

  const confirm = useCallback(
    (input: { quote: Quote; walletId: string; walletSessionId: string; network: Network; buyer: Buyer }) => {
      const body = {
        quoteId: input.quote.id,
        quoteFingerprint: input.quote.fingerprint,
        walletId: input.walletId,
        walletSessionId: input.walletSessionId,
        network: input.network,
        buyer: input.buyer,
      }
      // Reaproveita a chave se for exatamente a mesma tentativa (ex.: clique repetido após erro de rede).
      const existing = checkoutStorage.getAttempt(userId)
      const same = existing && !existing.orderId && JSON.stringify(existing.input) === JSON.stringify(body)
      const attempt: CheckoutAttempt = same
        ? existing
        : { userId, key: crypto.randomUUID(), input: body, orderId: null, createdAt: new Date().toISOString() }
      checkoutStorage.saveAttempt(attempt)
      return sendAttempt(attempt)
    },
    [sendAttempt, userId],
  )

  /** Retomada após refresh: tentativa sem resposta é reenviada com a mesma chave. */
  const resumePending = useCallback(() => {
    const a = checkoutStorage.getAttempt(userId)
    if (a && !a.orderId) return sendAttempt(a)
    return Promise.resolve(null)
  }, [sendAttempt, userId])

  return {
    quote,
    previousQuote,
    quoteStale,
    quoting,
    quoteError,
    submit,
    requestQuote,
    clearQuote,
    confirm,
    resumePending,
    isSubmitting: submit.status === 'submitting' || submit.status === 'recovering',
  }
}
