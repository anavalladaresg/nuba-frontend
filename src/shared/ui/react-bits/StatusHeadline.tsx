import { motion } from 'motion/react'
import { env } from '../../../config/env'

type StatusHeadlineProps = {
  subtitle: string
  title: string
}

export function StatusHeadline({ subtitle, title }: StatusHeadlineProps) {
  if (!env.visualEffectsEnabled) {
    return (
      <div className="space-y-2">
        <h3 className="text-2xl font-semibold tracking-tight text-nuba-text">{title}</h3>
        <p className="text-sm leading-6 text-nuba-text-muted">{subtitle}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <motion.h3
        key={title}
        initial={{ opacity: 0, filter: 'blur(10px)', y: 8 }}
        animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="text-2xl font-semibold tracking-tight text-nuba-text"
      >
        {title}
      </motion.h3>
      <p className="text-sm leading-6 text-nuba-text-muted">{subtitle}</p>
    </div>
  )
}
