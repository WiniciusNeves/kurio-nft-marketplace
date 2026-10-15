import { cn } from '@/lib/utils'

export function WalletBadges({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border border-line bg-band px-2 py-1 text-[9px] font-bold tracking-wide text-primary-strong',
        className,
      )}
    >
      METAMASK <span aria-hidden>·</span> WALLETCONNECT <span aria-hidden>·</span> COINBASE
    </span>
  )
}
