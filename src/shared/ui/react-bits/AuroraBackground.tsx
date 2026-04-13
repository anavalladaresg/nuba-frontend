import type { CSSProperties, PropsWithChildren } from 'react'
import { motion } from 'motion/react'
import { env } from '../../../config/env'
import { cn } from '../../utils/cn'

type AuroraBackgroundProps = PropsWithChildren<{
  className?: string
  colorStops?: [string, string, string] | string[]
  blend?: number
  speed?: number
  amplitude?: number
  disabled?: boolean
}>

export function AuroraBackground({
  amplitude = 0.52,
  blend = 0.2,
  children,
  className,
  colorStops = ['#121821', '#7C9EFF', '#B388FF'],
  disabled = !env.visualEffectsEnabled,
  speed = 0.3,
}: AuroraBackgroundProps) {
  if (disabled) {
    return <div className={className}>{children}</div>
  }

  const overlayStyle = (index: number): CSSProperties => ({
    background: `radial-gradient(circle at center, ${colorStops[index]} 0%, transparent 64%)`,
    opacity: blend,
  })

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <div className="pointer-events-none absolute inset-0">
        {[0, 1, 2].map((index) => (
          <motion.div
            key={colorStops[index]}
            className="absolute h-[55%] w-[55%] rounded-full blur-3xl"
            style={overlayStyle(index)}
            initial={{
              x: index * 12,
              y: index * 10,
              scale: 1,
            }}
            animate={{
              x: [0, 24 * amplitude, -18 * amplitude, 0],
              y: [0, -24 * amplitude, 16 * amplitude, 0],
              scale: [1, 1 + amplitude * 0.08, 0.98, 1],
            }}
            transition={{
              repeat: Number.POSITIVE_INFINITY,
              duration: 26 / speed,
              ease: 'easeInOut',
              delay: index * 0.5,
            }}
          />
        ))}
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  )
}
