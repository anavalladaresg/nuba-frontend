import type { PropsWithChildren, ReactNode } from 'react'
import { cn } from '../../utils/cn'

type SectionCardProps = PropsWithChildren<{
  title?: string
  description?: string
  actions?: ReactNode
  className?: string
}>

export function SectionCard({
  actions,
  children,
  className,
  description,
  title,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        'rounded-[32px] border border-white/8 bg-nuba-surface/90 p-5 shadow-nuba sm:p-6',
        className,
      )}
    >
      {title || description || actions ? (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title ? <h3 className="text-xl font-semibold text-nuba-text">{title}</h3> : null}
            {description ? (
              <p className="text-sm leading-6 text-nuba-text-muted">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}
