import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'h-10 w-full min-w-0 rounded-sm border border-line bg-background px-3 text-sm text-foreground placeholder:text-subtle',
        'focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none',
        'disabled:opacity-60 aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'min-h-36 w-full rounded-sm border border-line bg-background p-3 text-sm text-foreground placeholder:text-subtle',
        'focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'
