import { useEffect, useState } from 'react'

type CountUpProps = {
  from: number
  to: number
  duration: number
  className?: string
  formatter?: (value: number) => string
  easingFn?: (progress: number) => number
}

const defaultFormatter = (value: number) => Math.round(value).toString()
const naturalCountUpEasing = (progress: number) => 1 - Math.pow(1 - progress, 3)

export function CountUp({
  className,
  duration,
  easingFn = naturalCountUpEasing,
  formatter = defaultFormatter,
  from,
  to,
}: CountUpProps) {
  const safeFrom = Number.isFinite(from) ? from : 0
  const safeTo = Number.isFinite(to) ? to : 0
  const safeDurationMs = Math.max(0, duration * 1000)
  const [displayValue, setDisplayValue] = useState(() => safeFrom)

  useEffect(() => {
    if (safeFrom === safeTo || safeDurationMs === 0) {
      return undefined
    }

    let animationFrameId = 0
    let startedAt: number | null = null

    const animateFrame = (timestamp: number) => {
      if (startedAt === null) {
        startedAt = timestamp
      }

      const progress = Math.min((timestamp - startedAt) / safeDurationMs, 1)
      const easedProgress = easingFn(progress)

      setDisplayValue(safeFrom + (safeTo - safeFrom) * easedProgress)

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(animateFrame)
      }
    }

    animationFrameId = window.requestAnimationFrame(animateFrame)

    return () => window.cancelAnimationFrame(animationFrameId)
  }, [easingFn, safeDurationMs, safeFrom, safeTo])

  const renderedValue = safeFrom === safeTo || safeDurationMs === 0 ? safeTo : displayValue

  return <span className={className}>{formatter(renderedValue)}</span>
}
