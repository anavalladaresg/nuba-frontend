import type { PropsWithChildren, ReactNode } from 'react'
import { GlassSurface } from '../react-bits/GlassSurface'

type GlassSummaryCardProps = PropsWithChildren<{
  footer?: ReactNode
  title?: ReactNode
}>

export function GlassSummaryCard({
  children,
  footer,
  title,
}: GlassSummaryCardProps) {
  return (
    <GlassSurface className="rounded-[32px] p-5 shadow-nuba-elevated sm:p-6">
      {title ? <div className="mb-5">{title}</div> : null}
      {children}
      {footer ? <div className="mt-6">{footer}</div> : null}
    </GlassSurface>
  )
}
