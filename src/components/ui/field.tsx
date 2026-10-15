import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

interface FieldProps {
  id: string
  label: React.ReactNode
  required?: boolean
  error?: string
  hint?: string
  className?: string
  srOnlyLabel?: boolean
  children: (aria: {
    id: string
    'aria-invalid': boolean
    'aria-describedby'?: string
    'aria-required'?: boolean
  }) => React.ReactNode
}

/** Campo acessível: label associado, erro ligado via aria-describedby, estado inválido não depende só de cor. */
export function Field({ id, label, required, error, hint, className, srOnlyLabel, children }: FieldProps) {
  const errId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <Label htmlFor={id} className={cn(srOnlyLabel && 'sr-only')}>
        {label}
        {required && (
          <span className="ml-0.5 text-primary-strong" aria-hidden>
            *
          </span>
        )}
        {required && <span className="sr-only"> (obrigatório)</span>}
      </Label>
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="flex items-center gap-1 text-xs text-danger" role="alert">
          <span aria-hidden>⚠</span> {error}
        </p>
      )}
    </div>
  )
}
