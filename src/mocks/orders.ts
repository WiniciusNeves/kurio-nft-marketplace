/**
 * Processamento assíncrono de pedidos na simulação.
 * Pedido nasce `pending`; após `orderProcessingMs` vira `confirmed` ou `declined` (terminais).
 * Pedidos pendentes são retomados após refresh (o mock agenda de novo ao iniciar).
 */
import { eth } from '@/lib/eth'
import { getConfig } from './config'
import { db, nowIso, publicOrder, save, type DbOrder } from './db'
import { emitNftUpdated, emitOrderUpdated } from './realtime'

const timers = new Map<string, ReturnType<typeof setTimeout>>()

const EXPLORER: Record<DbOrder['network'], string> = {
  ethereum: 'https://etherscan.io/tx/',
  polygon: 'https://polygonscan.com/tx/',
  solana: 'https://solscan.io/tx/',
}

function fakeTxHash() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return '0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function scheduleOrder(order: DbOrder) {
  if (order.status !== 'pending' || timers.has(order.id)) return
  const wait = Math.max(0, order.processAt - Date.now())
  timers.set(
    order.id,
    setTimeout(() => {
      timers.delete(order.id)
      settleOrder(order.id)
    }, wait),
  )
}

export function resumePendingOrders() {
  db()
    .orders.filter((o) => o.status === 'pending')
    .forEach(scheduleOrder)
}

export function clearOrderTimers() {
  timers.forEach((t) => clearTimeout(t))
  timers.clear()
}

export function settleOrder(orderId: string) {
  const order = db().orders.find((o) => o.id === orderId)
  if (!order || order.status !== 'pending') return // terminal: nada a fazer

  const declined = getConfig().scenario === 'payment-declined'
  let reason: string | null = declined ? 'Pagamento recusado pela carteira (saldo insuficiente na simulação).' : null

  if (!reason) {
    for (const line of order.lines) {
      const nft = db().nfts.find((n) => n.id === line.nftId)
      const ed = nft?.editions.find((e) => e.id === line.editionId)
      if (!nft || !ed || ed.available < line.quantity) {
        reason = `Edição esgotada durante a liquidação: ${line.name} (${line.editionLabel}).`
        break
      }
    }
  }

  if (reason) {
    order.status = 'declined'
    order.failureReason = reason
  } else {
    // Liquida: baixa disponibilidade e remove do carrinho SOMENTE o que foi comprado.
    const touched = new Set<string>()
    for (const line of order.lines) {
      const nft = db().nfts.find((n) => n.id === line.nftId)!
      const ed = nft.editions.find((e) => e.id === line.editionId)!
      ed.available -= line.quantity
      nft.soldOut = nft.editions.every((e) => e.available === 0)
      nft.version += 1
      touched.add(nft.id)
    }
    const cart = db().carts.find((c) => c.id === order.cartId)
    if (cart) {
      for (const line of order.lines) {
        const item = cart.items.find((i) => i.nftId === line.nftId && i.editionId === line.editionId)
        if (item) item.quantity -= line.quantity
      }
      cart.items = cart.items.filter((i) => i.quantity > 0)
      if (cart.items.length === 0) cart.couponCode = null
      cart.updatedAt = nowIso()
    }
    order.status = 'confirmed'
    order.txHash = fakeTxHash()
    order.explorerUrl = EXPLORER[order.network] + order.txHash
    touched.forEach((id) => {
      const nft = db().nfts.find((n) => n.id === id)
      if (nft) emitNftUpdated(nft, 'availability')
    })
  }
  order.version += 1
  order.updatedAt = nowIso()
  save()
  emitOrderUpdated(publicOrder(order))
}

/** Usado para comparar o corpo de requisições com a mesma chave de idempotência. */
export function totalsMatch(a: string, b: string) {
  return eth.eq(a, b)
}
