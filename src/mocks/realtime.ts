/**
 * Servidor Socket.IO simulado com MSW (`ws.link`) + `@mswjs/socket.io-binding`.
 *
 * Transporte: apenas WebSocket (o cliente usa `transports: ['websocket']`).
 * O binding responde ao handshake do Engine.IO (`0{...}`) e ao CONNECT do namespace "/" (`40`).
 * Limitações do binding (documentadas no ARCHITECTURE.md): sem long-polling, sem rooms/namespaces,
 * sem heartbeat nativo — por isso enviamos o PING do Engine.IO manualmente (`2`).
 */
import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/api/contracts'
import { getConfig } from './config'
import { db, nowIso, save, uid } from './db'
import type { SeedNft } from './fixtures'
import { resolveToken } from './http'

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || 'wss://realtime.kurio.mock').replace(/\/$/, '')

/**
 * O MSW remove o prefixo `/socket.io/` do caminho ao casar conexões Socket.IO,
 * então o link aponta para a raiz do servidor (`wss://realtime.kurio.mock`).
 */
export const realtimeLink = ws.link(SOCKET_URL)

interface Conn {
  id: string
  userId: string | null
  token: string | null
  io: ReturnType<typeof toSocketIo>
  close: () => void
}

const connections = new Map<string, Conn>()

export const realtimeHandler = realtimeLink.addEventListener('connection', (connection) => {
  const io = toSocketIo(connection)
  const conn: Conn = {
    id: uid('sock'),
    userId: null,
    token: null,
    io,
    close: () => connection.client.close(),
  }

  if (getConfig().scenario === 'offline') {
    queueMicrotask(() => connection.client.close())
    return
  }

  connections.set(conn.id, conn)

  // Heartbeat do Engine.IO (o binding não implementa): evita "ping timeout" no cliente.
  const ping = setInterval(() => {
    try {
      connection.client.send('2')
    } catch {
      /* conexão encerrada */
    }
  }, 20_000)

  connection.client.addEventListener('message', (event) => {
    const data = event.data
    if (typeof data !== 'string') return
    // Pacote CONNECT do Socket.IO com payload de auth: 40{"token":"..."}
    if (data.startsWith('40')) {
      try {
        const auth = JSON.parse(data.slice(2) || '{}') as { token?: string }
        if (auth.token) {
          const r = resolveToken(auth.token)
          conn.token = auth.token
          conn.userId = r.status === 'ok' ? r.user.id : null
        }
      } catch {
        conn.userId = null
      }
    }
  })

  connection.client.addEventListener('close', () => {
    clearInterval(ping)
    connections.delete(conn.id)
  })
})

/** Ao fazer logout, conexões daquele token deixam de receber eventos privados. */
export function revokeRealtimeToken(token: string) {
  connections.forEach((c) => {
    if (c.token === token) c.userId = null
  })
}

export function emitNftUpdated(nft: SeedNft, reason: 'price' | 'availability' | 'both') {
  const event: NftUpdatedEvent = {
    eventId: uid('evt'),
    type: 'nft.updated',
    resourceId: nft.id,
    version: nft.version,
    occurredAt: nowIso(),
    payload: {
      nftId: nft.id,
      price: nft.price,
      compareAtPrice: nft.compareAtPrice,
      soldOut: nft.soldOut,
      editions: nft.editions.map((e) => ({ id: e.id, available: e.available, price: e.price })),
      reason,
    },
  }
  db().eventLog = [
    ...db().eventLog.slice(-49),
    {
      eventId: event.eventId,
      nftId: nft.id,
      version: event.version,
      payload: event.payload,
      occurredAt: event.occurredAt,
    },
  ]
  save()
  broadcast(event)
  return event
}

export function emitOrderUpdated(order: Order) {
  const event: OrderUpdatedEvent = {
    eventId: uid('evt'),
    type: 'order.updated',
    resourceId: order.id,
    version: order.version,
    occurredAt: nowIso(),
    userId: order.userId,
    payload: order,
  }
  connections.forEach((c) => {
    // Isolamento: somente sockets autenticados como o dono do pedido recebem o evento.
    if (c.userId === order.userId) c.io.client.emit('order.updated', event)
  })
  return event
}

function broadcast(event: NftUpdatedEvent) {
  connections.forEach((c) => c.io.client.emit('nft.updated', event))
}

/** Reenvia o último evento (mesmo eventId) — testa deduplicação no cliente. */
export function replayDuplicate() {
  const last = db().eventLog.at(-1)
  if (!last) return null
  const event = {
    eventId: last.eventId,
    type: 'nft.updated',
    resourceId: last.nftId,
    version: last.version,
    occurredAt: last.occurredAt,
    payload: last.payload,
  } as NftUpdatedEvent
  broadcast(event)
  return event
}

/** Envia um evento com versão antiga e dados divergentes — o cliente deve ignorar. */
export function replayStale() {
  const last = db().eventLog.at(-1)
  if (!last) return null
  const payload = last.payload as NftUpdatedEvent['payload']
  const event: NftUpdatedEvent = {
    eventId: uid('evt'),
    type: 'nft.updated',
    resourceId: last.nftId,
    version: Math.max(0, last.version - 1),
    occurredAt: new Date(Date.parse(last.occurredAt) - 60_000).toISOString(),
    payload: { ...payload, price: '99.99', editions: payload.editions.map((e) => ({ ...e, price: '99.99' })) },
  }
  broadcast(event)
  return event
}

/** Derruba todas as conexões do lado do "servidor" — o cliente reconecta sozinho. */
export function dropAllConnections() {
  const n = connections.size
  connections.forEach((c) => c.close())
  return n
}

export function connectionCount() {
  return connections.size
}
