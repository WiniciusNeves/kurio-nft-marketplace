/**
 * Aritmética de ETH com precisão decimal.
 * Valores entram e saem como string; nunca usamos Number para dinheiro.
 */
import Decimal from 'decimal.js'

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN })

export type EthLike = string | Decimal

const d = (v: EthLike) => (v instanceof Decimal ? v : new Decimal(v))

export const eth = {
  add: (...values: EthLike[]) => values.reduce<Decimal>((acc, v) => acc.plus(d(v)), new Decimal(0)),
  sub: (a: EthLike, b: EthLike) => d(a).minus(d(b)),
  mul: (a: EthLike, qty: number | EthLike) => d(a).times(typeof qty === 'number' ? qty : d(qty)),
  pct: (a: EthLike, percent: number) => d(a).times(percent).dividedBy(100),
  max0: (a: EthLike) => Decimal.max(0, d(a)),
  cmp: (a: EthLike, b: EthLike) => d(a).comparedTo(d(b)),
  eq: (a: EthLike, b: EthLike) => d(a).equals(d(b)),
  /** Serializa para o formato de transporte (string decimal, até 18 casas, sem zeros à direita). */
  toWire: (v: EthLike) => d(v).toDecimalPlaces(18).toFixed(),
}

/**
 * Formatação para exibição: mínimo de 2 casas, preservando casas significativas
 * (ex.: "26.846", "0.016", "1.19"). Nunca arredonda silenciosamente valores do recibo.
 */
export function formatEth(value: EthLike, opts: { suffix?: boolean } = {}) {
  const dec = d(value)
  const places = Math.max(2, dec.decimalPlaces())
  const s = dec.toFixed(places)
  return opts.suffix === false ? s : `${s} ETH`
}
