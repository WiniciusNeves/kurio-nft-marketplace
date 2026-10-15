/**
 * Painel da simulação (somente quando VITE_SHOW_MOCK_PANEL=true).
 * Não contém regra de negócio: apenas chama os endpoints de controle /api/__mock do MSW,
 * que alteram o banco simulado e emitem os eventos Socket.IO correspondentes.
 */
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FlaskConical } from 'lucide-react'
import { toast } from 'sonner'
import type { Cart } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogDescription, DialogTitle, SheetContent } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

async function call(path: string, init?: RequestInit) {
  const res = await fetch(`${base}/__mock${path}`, { headers: { 'Content-Type': 'application/json' }, ...init })
  if (!res.ok) throw new Error(`Falha em ${path}`)
  return res.json()
}

export function MockPanel() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [scenarios, setScenarios] = useState<Record<string, string>>({})
  const [scenario, setScenario] = useState('default')
  const [latency, setLatency] = useState<'auto' | 'none'>('auto')

  // O rodapé (e qualquer outra parte da UI) pode abrir o painel sem acoplamento direto.
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('kurio:open-mock-panel', onOpen)
    return () => window.removeEventListener('kurio:open-mock-panel', onOpen)
  }, [])

  useEffect(() => {
    if (!open) return
    call('/config')
      .then((r) => {
        setScenarios(r.scenarios)
        setScenario(r.config.scenario)
        setLatency(r.config.latency)
      })
      .catch(() => undefined)
  }, [open])

  const firstCartItem = () => {
    const carts = qc.getQueriesData<Cart>({ queryKey: ['cart'] })
    return carts.map(([, c]) => c?.items[0]).find(Boolean)
  }

  const act = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn()
      toast.success(label)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-3 z-40 hidden items-center gap-1.5 rounded-full border border-primary bg-background/90 px-3 py-2 text-xs font-bold text-primary shadow-lg md:flex"
        aria-label="Abrir painel de simulação"
        data-testid="mock-panel-toggle"
      >
        <FlaskConical className="size-4" aria-hidden /> Mocks
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="gap-4">
          <DialogTitle className="text-lg font-bold">Simulação (MSW)</DialogTitle>
          <DialogDescription className="text-xs text-muted">
            Cenários, condições de rede e eventos Socket.IO. Credenciais: ana@kurio.dev / bruno@kurio.dev — senha
            Kurio2026.
          </DialogDescription>

          <label className="text-sm font-bold" htmlFor="mock-scenario">
            Cenário
          </label>
          <Select
            value={scenario}
            onValueChange={(v) => {
              setScenario(v)
              void act(`Cenário: ${v}`, () => call('/config', { method: 'PUT', body: JSON.stringify({ scenario: v }) }))
            }}
          >
            <SelectTrigger id="mock-scenario">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(scenarios).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {k} — {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={latency === 'auto'}
              onChange={(e) => {
                const v = e.target.checked ? 'auto' : 'none'
                setLatency(v)
                void act(`Latência: ${v}`, () =>
                  call('/config', { method: 'PUT', body: JSON.stringify({ latency: v }) }),
                )
              }}
            />
            Aplicar latência do cenário
          </label>

          <div className="grid gap-2">
            <p className="text-sm font-bold">Tempo real</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const it = firstCartItem()
                if (!it) return toast.error('Adicione um item ao carrinho primeiro')
                void act(`Preço de ${it.name} +0.10 ETH`, () =>
                  call(`/nfts/${it.nftId}`, {
                    method: 'POST',
                    body: JSON.stringify({ editionId: it.editionId, deltaPrice: '0.1' }),
                  }),
                )
              }}
            >
              Alterar preço do 1º item do carrinho
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const it = firstCartItem()
                if (!it) return toast.error('Adicione um item ao carrinho primeiro')
                void act(`${it.name} esgotado`, () =>
                  call(`/nfts/${it.nftId}`, {
                    method: 'POST',
                    body: JSON.stringify({ editionId: it.editionId, available: 0 }),
                  }),
                )
              }}
            >
              Esgotar edição do 1º item
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void act('Evento duplicado emitido', () => call('/realtime/duplicate', { method: 'POST' }))
              }
            >
              Reemitir último evento (duplicata)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void act('Evento antigo emitido', () => call('/realtime/stale', { method: 'POST' }))}
            >
              Emitir evento antigo (versão menor)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void act('Conexões derrubadas', () => call('/realtime/disconnect', { method: 'POST' }))}
            >
              Derrubar conexão Socket.IO
            </Button>
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-bold">Sessão e dados</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void act('Sessões expiradas', () => call('/session/expire', { method: 'POST' }))}
            >
              Expirar sessão
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void act('Banco simulado restaurado', async () => {
                  await call('/reset', { method: 'POST' })
                  localStorage.removeItem('kurio:session')
                  localStorage.removeItem('kurio:guest-cart-id')
                  sessionStorage.clear()
                  location.reload()
                })
              }
            >
              Resetar cenário (dados iniciais)
            </Button>
          </div>
        </SheetContent>
      </Dialog>
    </>
  )
}
