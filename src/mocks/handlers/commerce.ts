import { HttpResponse, http } from 'msw'
import { addCartItemInputSchema, createOrderInputSchema, quoteInputSchema, type Cart } from '@/api/contracts'
import { eth } from '@/lib/eth'
import { getConfig } from '../config'
import { sha256Hex } from '../crypto'
import {
  buildQuote,
  cartOfUser,
  couponState,
  db,
  findNft,
  guestCart,
  nowIso,
  projectCart,
  publicOrder,
  publicQuote,
  save,
  uid,
  type DbCart,
  type DbOrder,
} from '../db'
import { api, applyNetwork, errorResponse, readJson, requireUser, sessionFrom } from '../http'
import { scheduleOrder } from '../orders'
import { emitNftUpdated } from '../realtime'

const GUEST_ID = /^gc_[a-z0-9-]{8,64}$/i

/** Resolve o carrinho da requisição: do usuário autenticado ou do visitante (header X-Cart-Id). */
function resolveCart(request: Request): { cart: DbCart } | { response: Response } {
  const s = sessionFrom(request)
  if (s.status === 'ok') return { cart: cartOfUser(s.user.id) }
  if (s.status === 'expired')
    return { response: errorResponse(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.') }
  if (s.status === 'invalid') return { response: errorResponse(401, 'UNAUTHENTICATED', 'Sessão inválida.') }
  const id = request.headers.get('x-cart-id') ?? ''
  if (!GUEST_ID.test(id))
    return { response: errorResponse(422, 'VALIDATION_ERROR', 'Identificador de carrinho ausente.') }
  if (db().carts.some((c) => c.id === id && c.userId !== null))
    return { response: errorResponse(403, 'FORBIDDEN', 'Carrinho pertence a outra conta.') }
  return { cart: guestCart(id) }
}

function cartJson(cart: DbCart, status = 200) {
  const body: Cart = projectCart(cart)
  return HttpResponse.json(body, { status })
}

function checkQuantity(nftId: string, editionId: string, quantity: number) {
  const nft = findNft(nftId)
  const ed = nft?.editions.find((e) => e.id === editionId)
  if (!nft || !ed) return { response: errorResponse(404, 'NOT_FOUND', 'NFT ou edição não encontrada.') }
  if (ed.available === 0)
    return {
      response: errorResponse(409, 'AVAILABILITY_CONFLICT', `A edição ${ed.label} está esgotada.`, {
        details: { available: 0 },
      }),
    }
  if (quantity > ed.maxPerOrder)
    return {
      response: errorResponse(
        422,
        'VALIDATION_ERROR',
        `Limite de ${ed.maxPerOrder} unidade(s) por pedido nesta edição.`,
        {
          fieldErrors: { quantity: `Máximo de ${ed.maxPerOrder}` },
          details: { maxPerOrder: ed.maxPerOrder },
        },
      ),
    }
  if (quantity > ed.available)
    return {
      response: errorResponse(409, 'AVAILABILITY_CONFLICT', `Apenas ${ed.available} unidade(s) disponível(is).`, {
        details: { available: ed.available },
      }),
    }
  return { nft, edition: ed }
}

export const commerceHandlers = [
  /* -------------------------- Carrinho -------------------------- */
  http.get(api('/cart'), async ({ request }) => {
    const fail = await applyNetwork(request, 'public')
    if (fail) return fail
    const r = resolveCart(request)
    if ('response' in r) return r.response
    return cartJson(r.cart)
  }),

  http.post(api('/cart/items'), async ({ request }) => {
    const fail = await applyNetwork(request, 'public')
    if (fail) return fail
    const r = resolveCart(request)
    if ('response' in r) return r.response
    const parsed = addCartItemInputSchema.safeParse(await readJson(request))
    if (!parsed.success) return errorResponse(422, 'VALIDATION_ERROR', 'Item inválido.')
    const { nftId, editionId, quantity } = parsed.data
    const existing = r.cart.items.find((i) => i.nftId === nftId && i.editionId === editionId)
    const nextQty = (existing?.quantity ?? 0) + quantity
    const chk = checkQuantity(nftId, editionId, nextQty)
    if ('response' in chk) return chk.response
    if (existing) {
      existing.quantity = nextQty
      existing.acknowledgedUnitPrice = chk.edition.price
    } else {
      r.cart.items.push({ id: uid('itm'), nftId, editionId, quantity, acknowledgedUnitPrice: chk.edition.price })
    }
    r.cart.updatedAt = nowIso()
    save()
    return cartJson(r.cart, 201)
  }),

  http.patch(api('/cart/items/:itemId'), async ({ request, params }) => {
    const fail = await applyNetwork(request, 'public')
    if (fail) return fail
    const r = resolveCart(request)
    if ('response' in r) return r.response
    const item = r.cart.items.find((i) => i.id === params.itemId)
    if (!item) return errorResponse(404, 'NOT_FOUND', 'Item não está no carrinho.')
    const body = await readJson<{ quantity?: number }>(request)
    const quantity = Number(body?.quantity)
    if (!Number.isInteger(quantity) || quantity < 1)
      return errorResponse(422, 'VALIDATION_ERROR', 'Quantidade inválida.', {
        fieldErrors: { quantity: 'Mínimo de 1' },
      })
    const chk = checkQuantity(item.nftId, item.editionId, quantity)
    if ('response' in chk) return chk.response
    item.quantity = quantity
    r.cart.updatedAt = nowIso()
    save()
    return cartJson(r.cart)
  }),

  http.delete(api('/cart/items/:itemId'), async ({ request, params }) => {
    const fail = await applyNetwork(request, 'public')
    if (fail) return fail
    const r = resolveCart(request)
    if ('response' in r) return r.response
    r.cart.items = r.cart.items.filter((i) => i.id !== params.itemId)
    if (!r.cart.items.length) r.cart.couponCode = null
    r.cart.updatedAt = nowIso()
    save()
    return cartJson(r.cart)
  }),

  /** Usuário confirma que viu as mudanças de preço. */
  http.post(api('/cart/acknowledge'), async ({ request }) => {
    const fail = await applyNetwork(request, 'public')
    if (fail) return fail
    const r = resolveCart(request)
    if ('response' in r) return r.response
    r.cart.items.forEach((i) => {
      const ed = findNft(i.nftId)?.editions.find((e) => e.id === i.editionId)
      if (ed) {
        i.acknowledgedUnitPrice = ed.price
        if (ed.available > 0 && i.quantity > ed.available) i.quantity = ed.available
      }
    })
    r.cart.items = r.cart.items.filter((i) => findNft(i.nftId)?.editions.find((e) => e.id === i.editionId)?.available)
    r.cart.updatedAt = nowIso()
    save()
    return cartJson(r.cart)
  }),

  http.put(api('/cart/coupon'), async ({ request }) => {
    const fail = await applyNetwork(request, 'public')
    if (fail) return fail
    const r = resolveCart(request)
    if ('response' in r) return r.response
    const body = await readJson<{ code?: string }>(request)
    const code = (body?.code ?? '').trim().toUpperCase()
    if (!code)
      return errorResponse(422, 'VALIDATION_ERROR', 'Informe um código.', {
        fieldErrors: { code: 'Informe um código promocional' },
      })
    if (!r.cart.items.length)
      return errorResponse(422, 'VALIDATION_ERROR', 'Adicione itens antes de aplicar um cupom.', {
        fieldErrors: { code: 'Carrinho vazio' },
      })
    const st = couponState(code)
    if (st === 'invalid')
      return errorResponse(422, 'COUPON_INVALID', 'Cupom inválido.', {
        fieldErrors: { code: 'Código promocional inválido' },
      })
    if (st === 'expired')
      return errorResponse(422, 'COUPON_EXPIRED', 'Cupom expirado.', {
        fieldErrors: { code: 'Este código promocional expirou' },
      })
    r.cart.couponCode = code
    r.cart.updatedAt = nowIso()
    save()
    return cartJson(r.cart)
  }),

  http.delete(api('/cart/coupon'), async ({ request }) => {
    const fail = await applyNetwork(request, 'public')
    if (fail) return fail
    const r = resolveCart(request)
    if ('response' in r) return r.response
    r.cart.couponCode = null
    r.cart.updatedAt = nowIso()
    save()
    return cartJson(r.cart)
  }),

  /** Ao autenticar, os itens do visitante são preservados no carrinho do usuário. */
  http.post(api('/cart/merge'), async ({ request }) => {
    const fail = await applyNetwork(request, 'private')
    if (fail) return fail
    const u = requireUser(request)
    if ('response' in u) return u.response
    const body = await readJson<{ guestCartId?: string }>(request)
    const userCart = cartOfUser(u.user.id)
    const guest = db().carts.find((c) => c.id === body?.guestCartId && c.userId === null)
    if (guest) {
      for (const gi of guest.items) {
        const ed = findNft(gi.nftId)?.editions.find((e) => e.id === gi.editionId)
        if (!ed) continue
        const ex = userCart.items.find((i) => i.nftId === gi.nftId && i.editionId === gi.editionId)
        const cap = Math.min(ed.available, ed.maxPerOrder)
        if (ex) ex.quantity = Math.min(cap, Math.max(ex.quantity, gi.quantity))
        else if (cap > 0) userCart.items.push({ ...gi, id: uid('itm'), quantity: Math.min(cap, gi.quantity) })
      }
      if (!userCart.couponCode && guest.couponCode) userCart.couponCode = guest.couponCode
      db().carts = db().carts.filter((c) => c.id !== guest.id)
      userCart.updatedAt = nowIso()
      save()
    }
    return cartJson(userCart)
  }),

  /* -------------------------- Cotação -------------------------- */
  http.post(api('/quote'), async ({ request }) => {
    const fail = await applyNetwork(request, 'private')
    if (fail) return fail
    const u = requireUser(request)
    if ('response' in u) return u.response
    const parsed = quoteInputSchema.safeParse(await readJson(request))
    if (!parsed.success)
      return errorResponse(422, 'VALIDATION_ERROR', 'Selecione uma rede.', {
        fieldErrors: { network: 'Selecione uma rede' },
      })
    const cart = cartOfUser(u.user.id)
    if (!cart.items.length) return errorResponse(422, 'VALIDATION_ERROR', 'Seu carrinho está vazio.')
    const quote = await buildQuote(cart, parsed.data.network, u.user.id)
    return HttpResponse.json(publicQuote(quote))
  }),

  /* -------------------------- Pedidos -------------------------- */
  http.post(api('/orders'), async ({ request }) => {
    const fail = await applyNetwork(request, 'private')
    if (fail) return fail
    const u = requireUser(request)
    if ('response' in u) return u.response
    const key = request.headers.get('idempotency-key')
    if (!key || key.length < 16) return errorResponse(422, 'VALIDATION_ERROR', 'Header Idempotency-Key obrigatório.')
    const raw = await readJson(request)
    const parsed = createOrderInputSchema.safeParse(raw)
    if (!parsed.success) return errorResponse(422, 'VALIDATION_ERROR', 'Dados do pedido inválidos.')
    const input = parsed.data
    const bodyHash = await sha256Hex(JSON.stringify(input))
    const scenario = getConfig().scenario

    // 1. Idempotência: mesma tentativa => mesmo pedido; mesma chave com outro conteúdo => conflito.
    const prior = db().idempotency[key]
    if (prior) {
      if (prior.userId !== u.user.id || prior.bodyHash !== bodyHash) {
        return errorResponse(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
      }
      const existing = db().orders.find((o) => o.id === prior.orderId)!
      return HttpResponse.json(publicOrder(existing), { status: 200, headers: { 'Idempotent-Replayed': 'true' } })
    }

    // 2. Cotação precisa existir, pertencer ao usuário e estar válida.
    const quote = db().quotes.find((q) => q.id === input.quoteId && q.userId === u.user.id)
    if (!quote || Date.parse(quote.expiresAt) < Date.now()) {
      return errorResponse(409, 'QUOTE_EXPIRED', 'A cotação expirou. Revise os valores e confirme novamente.')
    }

    // 3. Cenários que alteram o catálogo no momento da compra (uma vez por cenário).
    const cart = cartOfUser(u.user.id)
    const first = quote.lines[0]
    if (first && scenario === 'checkout-price-change' && !db().flags['price-change-fired']) {
      const nft = findNft(first.nftId)!
      const ed = nft.editions.find((e) => e.id === first.editionId)!
      ed.price = eth.toWire(eth.add(ed.price, '0.1'))
      if (ed.id === '1-50') nft.price = ed.price
      nft.version += 1
      db().flags['price-change-fired'] = true
      save()
      emitNftUpdated(nft, 'price')
    }
    if (first && scenario === 'checkout-sold-out' && !db().flags['sold-out-fired']) {
      const nft = findNft(first.nftId)!
      const ed = nft.editions.find((e) => e.id === first.editionId)!
      ed.available = 0
      nft.soldOut = nft.editions.every((e) => e.available === 0)
      nft.version += 1
      db().flags['sold-out-fired'] = true
      save()
      emitNftUpdated(nft, 'availability')
    }

    // 4. Revalidação: preço, disponibilidade, cupom e taxas.
    const fresh = await buildQuote(cart, input.network, u.user.id)
    if (fresh.issues.length) {
      return errorResponse(409, 'AVAILABILITY_CONFLICT', 'Um ou mais itens não têm mais disponibilidade suficiente.', {
        details: { quote: publicQuote(fresh) },
      })
    }
    if (fresh.fingerprint !== input.quoteFingerprint || quote.fingerprint !== input.quoteFingerprint) {
      return errorResponse(409, 'QUOTE_CHANGED', 'Os valores do pedido mudaram. Revise e confirme novamente.', {
        details: { quote: publicQuote(fresh) },
      })
    }

    // 5. Carteira conectada.
    const wss = db().walletSessions.find(
      (w) => w.id === input.walletSessionId && w.userId === u.user.id && w.walletId === input.walletId,
    )
    const wallet = db().wallets.find((w) => w.id === input.walletId && w.userId === u.user.id)
    if (!wss || !wallet)
      return errorResponse(409, 'WALLET_NOT_CONNECTED', 'Conecte sua carteira para confirmar a compra.')

    // 6. Cria o pedido (snapshot imutável da cotação).
    const order: DbOrder = {
      id: uid('ord'),
      userId: u.user.id,
      status: 'pending',
      quoteId: fresh.id,
      network: input.network,
      lines: fresh.lines,
      subtotal: fresh.subtotal,
      discount: fresh.discount,
      networkFee: fresh.networkFee,
      total: fresh.total,
      coupon: fresh.coupon,
      wallet: {
        id: wallet.id,
        label: wallet.nickname,
        provider: wss.provider ?? wallet.provider,
        address: wallet.address,
      },
      buyer: input.buyer,
      txHash: null,
      explorerUrl: null,
      failureReason: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      version: 1,
      processAt: Date.now() + getConfig().orderProcessingMs,
      cartId: cart.id,
    }
    db().orders.push(order)
    db().idempotency[key] = { userId: u.user.id, bodyHash, orderId: order.id }
    save()
    scheduleOrder(order)

    // 7. Cenário: o pedido foi criado, mas a resposta se perde (timeout de rede).
    if (scenario === 'order-timeout' && !db().flags[`timeout-${key}`]) {
      db().flags[`timeout-${key}`] = true
      save()
      return HttpResponse.error()
    }
    return HttpResponse.json(publicOrder(order), { status: 201 })
  }),

  http.get(api('/orders/:id'), async ({ request, params }) => {
    const fail = await applyNetwork(request, 'private')
    if (fail) return fail
    const u = requireUser(request)
    if ('response' in u) return u.response
    const order = db().orders.find((o) => o.id === params.id)
    // 404 também para pedidos de outro usuário: não vaza existência.
    if (!order || order.userId !== u.user.id) return errorResponse(404, 'NOT_FOUND', 'Pedido não encontrado.')
    return HttpResponse.json(publicOrder(order))
  }),

  http.get(api('/orders'), async ({ request }) => {
    const fail = await applyNetwork(request, 'private')
    if (fail) return fail
    const u = requireUser(request)
    if ('response' in u) return u.response
    const status = new URL(request.url).searchParams.get('status')
    const items = db()
      .orders.filter((o) => o.userId === u.user.id && (!status || o.status === status))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map(publicOrder)
    return HttpResponse.json({ items })
  }),
]
