/**
 * Configuração dos cenários de mock.
 *
 * Seleção (em ordem de prioridade):
 *  1. query string `?mock-scenario=<id>` (também aceita `&mock-latency=none|auto`)
 *  2. localStorage `kurio:mock:config` (persistido pelo painel de mocks / testes)
 *  3. variável `VITE_MOCK_SCENARIO`
 *
 * `?mock-reset=1` restaura integralmente o banco simulado ao cenário conhecido.
 */

export const SCENARIOS = {
  default: 'Padrão — sucesso, latência leve determinística',
  empty: 'Catálogo vazio',
  slow: 'Rede lenta (2,5 s por requisição)',
  'variable-latency': 'Latência variável determinística (200 ms–2 s)',
  'out-of-order': 'Respostas do catálogo fora de ordem',
  offline: 'Sem conexão (falha de rede em toda a API)',
  timeout: 'Timeout: 1ª requisição do catálogo/detalhe não responde (cliente aborta em 10 s e tenta de novo)',
  'server-error': 'Erro 500 no catálogo e detalhe',
  flaky: 'Falha transitória (503 na 1ª tentativa de cada rota, depois sucesso)',
  unauthorized: 'Acesso negado (403) nas rotas privadas',
  'short-session': 'Sessão expira 20 s após o login',
  'favorites-fail': 'Mutations de favoritos falham (503)',
  'checkout-price-change': 'Preço muda ao confirmar o pedido',
  'checkout-sold-out': 'Edição esgota ao confirmar o pedido',
  'order-timeout': 'Resposta da criação do pedido se perde (timeout) — recuperação por idempotência',
  'payment-declined': 'Pagamento recusado',
  'wallet-rejected': 'Usuário recusa a conexão da carteira',
} as const

export type ScenarioId = keyof typeof SCENARIOS

export interface MockConfig {
  scenario: ScenarioId
  /** `auto` aplica a latência do cenário; `none` zera (usado nos testes). */
  latency: 'auto' | 'none'
  /** Tempo até a "rede" confirmar/recusar um pedido pendente. */
  orderProcessingMs: number
}

const STORAGE_KEY = 'kurio:mock:config'

export const DEFAULT_CONFIG: MockConfig = {
  scenario: (import.meta.env.VITE_MOCK_SCENARIO as ScenarioId) || 'default',
  latency: 'auto',
  orderProcessingMs: 2500,
}

function isScenario(v: unknown): v is ScenarioId {
  return typeof v === 'string' && v in SCENARIOS
}

let current: MockConfig = DEFAULT_CONFIG

export function loadConfig(): MockConfig {
  let stored: Partial<MockConfig> = {}
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    stored = {}
  }
  const params = new URLSearchParams(window.location.search)
  const fromUrl = params.get('mock-scenario')
  const latencyUrl = params.get('mock-latency')
  const orderMsUrl = params.get('mock-order-ms')

  current = {
    ...DEFAULT_CONFIG,
    ...stored,
    ...(isScenario(fromUrl) ? { scenario: fromUrl } : {}),
    ...(latencyUrl === 'none' || latencyUrl === 'auto' ? { latency: latencyUrl } : {}),
    ...(orderMsUrl && !Number.isNaN(Number(orderMsUrl)) ? { orderProcessingMs: Number(orderMsUrl) } : {}),
  }
  if (!isScenario(current.scenario)) current.scenario = 'default'
  persist()
  return current
}

export function getConfig() {
  return current
}

export function setConfig(patch: Partial<MockConfig>) {
  current = { ...current, ...patch }
  if (!isScenario(current.scenario)) current.scenario = 'default'
  persist()
  return current
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    /* storage indisponível: mantém em memória */
  }
}

export function shouldResetFromUrl() {
  return new URLSearchParams(window.location.search).get('mock-reset') === '1'
}
