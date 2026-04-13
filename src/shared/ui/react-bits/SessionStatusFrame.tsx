import type { PropsWithChildren } from 'react'
import { env } from '../../../config/env'
import { cn } from '../../utils/cn'

export type SessionVisualState = 'idle' | 'started' | 'paused' | 'completed'

type SessionStatusFrameProps = PropsWithChildren<{
  className?: string
  disabled?: boolean
  state: SessionVisualState
}>

const stateConfig: Record<
  SessionVisualState,
  {
    borderClassName: string
    color: string
    chaos: number
    speed: number
  }
> = {
  idle: {
    borderClassName: 'border-white/10',
    color: '#7C9EFF',
    chaos: 0.04,
    speed: 0.45,
  },
  started: {
    borderClassName: 'border-nuba-check-in/30',
    color: '#5BE7A9',
    chaos: 0.08,
    speed: 1,
  },
  paused: {
    borderClassName: 'border-nuba-break/30',
    color: '#FFD166',
    chaos: 0.07,
    speed: 0.82,
  },
  completed: {
    borderClassName: 'border-nuba-check-out/30',
    color: '#7C9EFF',
    chaos: 0.035,
    speed: 0.4,
  },
}

export function SessionStatusFrame({
  children,
  className,
  disabled = !env.visualEffectsEnabled,
  state,
}: SessionStatusFrameProps) {
  const config = stateConfig[state]

  return (
    <div
      className={cn(
        'rounded-[32px] border bg-transparent p-[1px]',
        !disabled && 'transition-shadow duration-300',
        config.borderClassName,
        className,
      )}
    >
      <div className="relative z-10">{children}</div>
    </div>
  )
}
