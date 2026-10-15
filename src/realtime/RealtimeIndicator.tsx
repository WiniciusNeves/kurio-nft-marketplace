import { useSyncExternalStore } from 'react'
import { realtime } from './realtime'
import { cn } from '@/lib/utils'

const LABEL = {
  idle: 'Tempo real inativo',
  connecting: 'Conectando ao tempo real',
  connected: 'Tempo real conectado',
  reconnecting: 'Tempo real reconectando',
  disconnected: 'Tempo real desconectado',
} as const

export function useRealtimeStatus() {
  return useSyncExternalStore(
    (cb) => realtime.onStatus(cb),
    () => realtime.status,
    () => realtime.status,
  )
}

/** Indicador discreto; mudanças de estado são anunciadas para leitores de tela. */
export function RealtimeIndicator() {
  const status = useRealtimeStatus()
  return (
    <span className="flex items-center" data-testid="realtime-status" data-status={status}>
      <span
        className={cn(
          'size-2 rounded-full',
          status === 'connected' && 'bg-success',
          (status === 'connecting' || status === 'reconnecting') && 'animate-pulse bg-warning',
          (status === 'idle' || status === 'disconnected') && 'bg-subtle',
        )}
        title={LABEL[status]}
        aria-hidden
      />
      <span className="sr-only" role="status" aria-live="polite">
        {status === 'reconnecting' ? LABEL[status] : ''}
      </span>
    </span>
  )
}
