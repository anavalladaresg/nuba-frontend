import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

type SummaryCardProps = {
  title: string
  value: string
  caption?: string
  badge?: ReactNode
  className?: string
}

export function SummaryCard({
  badge,
  caption,
  className,
  title,
  value,
}: SummaryCardProps) {
  return (
    <article
      className={cn(
        'rounded-[28px] border border-white/8 bg-nuba-surface-elevated/90 p-5 shadow-nuba',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-nuba-text-muted">{title}</p>
          <p className="text-3xl font-semibold tracking-tight text-nuba-text">{value}</p>
        </div>
        {badge}
      </div>
      {caption ? <p className="mt-4 text-sm leading-6 text-nuba-text-muted">{caption}</p> : null}
    </article>
  )
}
