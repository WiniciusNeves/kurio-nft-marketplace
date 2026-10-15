/**
 * Cliente de tempo real (socket.io-client) e reconciliação com o cache do TanStack Query.
 *
 * Garantias:
 *  - idempotência: eventId já aplicado é ignorado (duplicatas);
 *  - ordenação: versão <= versão conhecida do recurso é ignorada (eventos antigos não regridem estado);
 *  - isolamento: order.updated de outro usuário é descartado; socket é recriado ao trocar de sessão;
 *  - reconexão: ao reconectar, recursos ativos são reconciliados via REST (invalidate).
 */
import { io, type Socket } from 'socket.io-client'
import type { QueryClient } from '@tanstack/react-query'
import {
  realtimeEventSchema,
  type CatalogResponse,
  type Nft,
  type NftUpdatedEvent,
  type Order,
  type OrderUpdatedEvent,
} from '@/api/contracts'
import { qk } from '@/api/queryKeys'

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

type Listener<T> = (v: T) => void

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'wss://realtime.kurio.mock'
const MAX_SEEN = 500

class RealtimeClient {
  private socket: Socket | null = null
  private qc: QueryClient | null = null
  private userId: string | null = null
  private seen = new Set<string>()
  private versions = new Map<string, number>()
  private hasConnected = false
  status: RealtimeStatus = 'idle'
  private statusListeners = new Set<Listener<RealtimeStatus>>()
  private nftListeners = new Set<Listener<NftUpdatedEvent>>()
  private orderListeners = new Set<Listener<OrderUpdatedEvent>>()

  /** (Re)conecta para a sessão atual. Chamado sempre que token/usuário muda. */
  start(qc: QueryClient, auth: { token: string | null; userId: string | null }) {
    this.stop()
    this.qc = qc
    this.userId = auth.userId
    this.hasConnected = false
    this.setStatus('connecting')

    const socket = io(SOCKET_URL, {
      transports: ['websocket'], // o binding do MSW intercepta somente WebSocket
      auth: auth.token ? { token: auth.token } : {},
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      timeout: 8000,
    })
    this.socket = socket

    socket.on('connect', () => {
      const isReconnect = this.hasConnected
      this.hasConnected = true
      this.setStatus('connected')
      if (isReconnect) this.reconcile()
    })
    socket.on('disconnect', (reason) => {
      // "io client disconnect" = encerramos de propósito (logout/troca de usuário).
      this.setStatus(reason === 'io client disconnect' ? 'disconnected' : 'reconnecting')
    })
    socket.io.on('reconnect_attempt', () => this.setStatus('reconnecting'))
    socket.on('nft.updated', (raw: unknown) => this.handle(raw))
    socket.on('order.updated', (raw: unknown) => this.handle(raw))
  }

  /** Libera listeners e a conexão da sessão anterior. */
  stop() {
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.io.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }
    this.setStatus('idle')
  }

  /** Força a reconciliação (também usada após refresh/retomada do checkout). */
  reconcile() {
    const qc = this.qc
    if (!qc) return
    void qc.invalidateQueries({ queryKey: qk.nftAll, refetchType: 'active' })
    void qc.invalidateQueries({ queryKey: qk.catalogAll, refetchType: 'active' })
    void qc.invalidateQueries({ queryKey: qk.cartAll, refetchType: 'active' })
    if (this.userId) void qc.invalidateQueries({ queryKey: qk.ordersAll(this.userId), refetchType: 'active' })
  }

  onStatus(l: Listener<RealtimeStatus>) {
    this.statusListeners.add(l)
    return () => void this.statusListeners.delete(l)
  }
  onNftUpdated(l: Listener<NftUpdatedEvent>) {
    this.nftListeners.add(l)
    return () => void this.nftListeners.delete(l)
  }
  onOrderUpdated(l: Listener<OrderUpdatedEvent>) {
    this.orderListeners.add(l)
    return () => void this.orderListeners.delete(l)
  }

  /** Visível para testes de unidade/diagnóstico. */
  knownVersion(key: string) {
    return this.versions.get(key)
  }

  private setStatus(s: RealtimeStatus) {
    if (this.status === s) return
    this.status = s
    this.statusListeners.forEach((l) => l(s))
  }

  private handle(raw: unknown) {
    const parsed = realtimeEventSchema.safeParse(raw)
    if (!parsed.success || !this.qc) return
    const event = parsed.data
    if (this.seen.has(event.eventId)) return // duplicata
    this.remember(event.eventId)

    const key = `${event.type}:${event.resourceId}`
    const current = Math.max(this.versions.get(key) ?? 0, this.cachedVersion(event))
    if (event.version <= current) return // evento antigo ou já refletido via REST
    this.versions.set(key, event.version)

    if (event.type === 'nft.updated') {
      this.applyNft(event)
      this.nftListeners.forEach((l) => l(event))
    } else {
      if (!this.userId || event.userId !== this.userId) return // nunca aplica dados de outro usuário
      this.applyOrder(event)
      this.orderListeners.forEach((l) => l(event))
    }
  }

  private remember(id: string) {
    this.seen.add(id)
    if (this.seen.size > MAX_SEEN) {
      const first = this.seen.values().next().value
      if (first) this.seen.delete(first)
    }
  }

  private cachedVersion(event: NftUpdatedEvent | OrderUpdatedEvent) {
    const qc = this.qc!
    if (event.type === 'nft.updated') return qc.getQueryData<Nft>(qk.nft(event.resourceId))?.version ?? 0
    if (!this.userId) return 0
    return qc.getQueryData<Order>(qk.order(this.userId, event.resourceId))?.version ?? 0
  }

  private applyNft(event: NftUpdatedEvent) {
    const qc = this.qc!
    const p = event.payload
    qc.setQueryData<Nft>(qk.nft(p.nftId), (old) =>
      old
        ? {
            ...old,
            price: p.price,
            compareAtPrice: p.compareAtPrice,
            soldOut: p.soldOut,
            version: event.version,
            editions: old.editions.map((e) => {
              const u = p.editions.find((x) => x.id === e.id)
              return u ? { ...e, available: u.available, price: u.price } : e
            }),
          }
        : old,
    )
    qc.setQueriesData<CatalogResponse>({ queryKey: qk.catalogAll }, (old) =>
      old
        ? {
            ...old,
            items: old.items.map((i) =>
              i.id === p.nftId && i.version < event.version
                ? { ...i, price: p.price, compareAtPrice: p.compareAtPrice, soldOut: p.soldOut, version: event.version }
                : i,
            ),
          }
        : old,
    )
    // Carrinho depende de preço/disponibilidade calculados no servidor: reconcilia via REST.
    void qc.invalidateQueries({ queryKey: qk.cartAll })
  }

  private applyOrder(event: OrderUpdatedEvent) {
    const qc = this.qc!
    qc.setQueryData<Order>(qk.order(this.userId!, event.resourceId), event.payload)
    void qc.invalidateQueries({ queryKey: qk.pendingOrders(this.userId!) })
    if (event.payload.status === 'confirmed') void qc.invalidateQueries({ queryKey: qk.cartAll })
  }
}

export const realtime = new RealtimeClient()
