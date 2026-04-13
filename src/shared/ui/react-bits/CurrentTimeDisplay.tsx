import { motion } from 'motion/react'
import { formatClockFromSeconds } from '../../utils/format'

type CurrentTimeDisplayProps = {
  seconds: number
  label: string
  caption: string
  animateKey: string
}

export function CurrentTimeDisplay({
  animateKey,
  caption,
  label,
  seconds,
}: CurrentTimeDisplayProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.28em] text-nuba-text-muted/80">{label}</p>
        <motion.p
          key={animateKey}
          initial={{ opacity: 0, y: 8, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="font-mono text-[clamp(2.5rem,8vw,4.6rem)] font-semibold tracking-tight text-nuba-text"
        >
          {formatClockFromSeconds(seconds)}
        </motion.p>
      </div>
      <p className="max-w-sm text-sm leading-6 text-nuba-text-muted">{caption}</p>
    </div>
  )
}
