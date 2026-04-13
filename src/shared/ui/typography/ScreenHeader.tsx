import type { ReactNode } from 'react'

type ScreenHeaderProps = {
  title: string
  description: string
  eyebrow?: string
  actions?: ReactNode
}

export function ScreenHeader({
  actions,
  description,
  eyebrow,
  title,
}: ScreenHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-[32px] border border-white/6 bg-nuba-surface/70 p-6 shadow-nuba sm:p-7 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-nuba-text-muted/80">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-2xl font-semibold tracking-tight text-nuba-text sm:text-3xl">
          {title}
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-nuba-text-muted sm:text-base">
          {description}
        </p>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  )
}
