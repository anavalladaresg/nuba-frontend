import type { PropsWithChildren } from 'react'
import { env } from '../../../config/env'
import { cn } from '../../utils/cn'

type GlassSurfaceProps = PropsWithChildren<{
  className?: string
  disabled?: boolean
}>

export function GlassSurface({
  children,
  className,
  disabled = !env.visualEffectsEnabled,
}: GlassSurfaceProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden border border-white/10 bg-nuba-surface/90',
        disabled ? 'shadow-nuba' : 'bg-white/[0.04] backdrop-blur-2xl shadow-nuba-elevated',
        className,
      )}
    >
      {!disabled ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/8 to-transparent" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-32 w-32 rounded-full bg-nuba-brand/10 blur-3xl" />
        </>
      ) : null}
      <div className="relative z-10">{children}</div>
    </div>
  )
}
