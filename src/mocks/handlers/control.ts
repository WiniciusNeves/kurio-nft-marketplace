/**
 * Endpoints de controle da simulação (usados pelo painel de mocks e pelos testes Playwright).
 * Ficam sob /api/__mock e NÃO passam pelas condições de rede do cenário.
 * Toda mudança de dados aqui é refletida tanto nas respostas REST quanto nos eventos Socket.IO.
 */
import { HttpResponse, http } from 'msw'
import { eth } from '@/lib/eth'
import { SCENARIOS, getConfig, setConfig, type MockConfig } from '../config'
import { findNft, resetDb, save } from '../db'
import { api, errorResponse, expireAllSessions, readJson, resetNetworkCounters } from '../http'
import { clearOrderTimers, resumePendingOrders } from '../orders'
import { connectionCount, dropAllConnections, emitNftUpdated, replayDuplicate, replayStale } from '../realtime'

export const controlHandlers = [
  http.get(api('/__mock/config'), () =>
    HttpResponse.json({ config: getConfig(), scenarios: SCENARIOS, sockets: connectionCount() }),
  ),

  http.put(api('/__mock/config'), async ({ request }) => {
    const body = (await readJson<Partial<MockConfig>>(request)) ?? {}
    resetNetworkCounters()
    return HttpResponse.json({ config: setConfig(body) })
  }),

  http.post(api('/__mock/reset'), async () => {
    clearOrderTimers()
    resetNetworkCounters()
    await resetDb()
    resumePendingOrders()
    return HttpResponse.json({ ok: true })
  }),

  http.post(api('/__mock/session/expire'), () => {
    expireAllSessions()
    return HttpResponse.json({ ok: true })
  }),

  /** Altera preço e/ou disponibilidade de um NFT e emite `nft.updated`. */
  http.post(api('/__mock/nfts/:id'), async ({ params, request }) => {
    const nft = findNft(String(params.id))
    if (!nft) return errorResponse(404, 'NOT_FOUND', 'NFT não encontrado.')
    const body =
      (await readJson<{ editionId?: string; price?: string; deltaPrice?: string; available?: number }>(request)) ?? {}
    const ed = nft.editions.find((e) => e.id === (body.editionId ?? '1-50'))
    if (!ed) return errorResponse(404, 'NOT_FOUND', 'Edição não encontrada.')
    let reason: 'price' | 'availability' | 'both' = 'price'
    if (body.price || body.deltaPrice) {
      ed.price = body.price ?? eth.toWire(eth.add(ed.price, body.deltaPrice!))
      if (ed.id === '1-50') nft.price = ed.price
    }
    if (typeof body.available === 'number') {
      ed.available = Math.max(0, Math.floor(body.available))
      nft.soldOut = nft.editions.every((e) => e.available === 0)
      reason = body.price || body.deltaPrice ? 'both' : 'availability'
    }
    nft.version += 1
    save()
    const event = emitNftUpdated(nft, reason)
    return HttpResponse.json({ event })
  }),

  http.post(api('/__mock/realtime/duplicate'), () => HttpResponse.json({ event: replayDuplicate() })),
  http.post(api('/__mock/realtime/stale'), () => HttpResponse.json({ event: replayStale() })),
  http.post(api('/__mock/realtime/disconnect'), () => HttpResponse.json({ dropped: dropAllConnections() })),
]
