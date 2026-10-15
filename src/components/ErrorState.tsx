import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toApiError } from '@/api/errors'

export function ErrorState({
  error,
  title = 'Não foi possível carregar',
  onRetry,
  retrying,
}: {
  error: unknown
  title?: string
  onRetry?: () => void
  retrying?: boolean
}) {
  const e = toApiError(error)
  return (
    <div role="alert" className="flex flex-col items-center gap-3 border border-line bg-surface px-6 py-10 text-center">
      <AlertTriangle className="size-8 text-warning" aria-hidden />
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="max-w-md text-sm text-muted">{e.message}</p>
      {onRetry && (
        <Button onClick={onRetry} loading={retrying}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}
