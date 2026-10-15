import { cn } from '@/lib/utils'

/** Skeleton com shimmer (respeita prefers-reduced-motion via globals.css). */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('skeleton rounded-sm', className)} {...props} />
}
