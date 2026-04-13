import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type PropsWithChildren,
} from 'react'
import { cn } from '../../utils/cn'

type ElectricBorderProps = PropsWithChildren<{
  borderRadius?: number
  chaos?: number
  className?: string
  color?: string
  speed?: number
  style?: CSSProperties
  thickness?: number
}>

function hexToRgba(hex: string, alpha = 1) {
  if (!hex) {
    return `rgba(0, 0, 0, ${alpha})`
  }

  let normalized = hex.replace('#', '')
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((value) => `${value}${value}`)
      .join('')
  }

  const parsed = Number.parseInt(normalized, 16)
  const red = (parsed >> 16) & 255
  const green = (parsed >> 8) & 255
  const blue = parsed & 255

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export function ElectricBorder({
  children,
  color = '#5227FF',
  speed = 1,
  chaos = 0.12,
  borderRadius = 24,
  className,
  style,
  thickness = 2,
}: ElectricBorderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const animationRef = useRef<number | null>(null)
  const timeRef = useRef(0)
  const lastFrameTimeRef = useRef(0)

  const random = useCallback((value: number) => {
    return (Math.sin(value * 12.9898) * 43758.5453) % 1
  }, [])

  const noise2D = useCallback(
    (x: number, y: number) => {
      const i = Math.floor(x)
      const j = Math.floor(y)
      const fx = x - i
      const fy = y - j

      const a = random(i + j * 57)
      const b = random(i + 1 + j * 57)
      const c = random(i + (j + 1) * 57)
      const d = random(i + 1 + (j + 1) * 57)

      const ux = fx * fx * (3 - 2 * fx)
      const uy = fy * fy * (3 - 2 * fy)

      return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy
    },
    [random],
  )

  const octavedNoise = useCallback(
    (
      x: number,
      octaves: number,
      lacunarity: number,
      gain: number,
      baseAmplitude: number,
      baseFrequency: number,
      time: number,
      seed: number,
      baseFlatness: number,
    ) => {
      let value = 0
      let amplitudeCursor = baseAmplitude
      let frequencyCursor = baseFrequency

      for (let index = 0; index < octaves; index += 1) {
        let octaveAmplitude = amplitudeCursor
        if (index === 0) {
          octaveAmplitude *= baseFlatness
        }

        value += octaveAmplitude * noise2D(frequencyCursor * x + seed * 100, time * frequencyCursor * 0.3)
        frequencyCursor *= lacunarity
        amplitudeCursor *= gain
      }

      return value
    },
    [noise2D],
  )

  const getCornerPoint = useCallback(
    (
      centerX: number,
      centerY: number,
      radius: number,
      startAngle: number,
      arcLength: number,
      progress: number,
    ) => {
      const angle = startAngle + progress * arcLength

      return {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      }
    },
    [],
  )

  const getRoundedRectPoint = useCallback(
    (
      progress: number,
      left: number,
      top: number,
      width: number,
      height: number,
      radius: number,
    ) => {
      const straightWidth = width - 2 * radius
      const straightHeight = height - 2 * radius
      const cornerArc = (Math.PI * radius) / 2
      const totalPerimeter = 2 * straightWidth + 2 * straightHeight + 4 * cornerArc
      const distance = progress * totalPerimeter

      let accumulated = 0

      if (straightWidth > 0 && distance <= accumulated + straightWidth) {
        const offset = (distance - accumulated) / straightWidth
        return { x: left + radius + offset * straightWidth, y: top }
      }
      accumulated += straightWidth

      if (distance <= accumulated + cornerArc) {
        const arcProgress = (distance - accumulated) / cornerArc
        return getCornerPoint(
          left + width - radius,
          top + radius,
          radius,
          -Math.PI / 2,
          Math.PI / 2,
          arcProgress,
        )
      }
      accumulated += cornerArc

      if (straightHeight > 0 && distance <= accumulated + straightHeight) {
        const offset = (distance - accumulated) / straightHeight
        return { x: left + width, y: top + radius + offset * straightHeight }
      }
      accumulated += straightHeight

      if (distance <= accumulated + cornerArc) {
        const arcProgress = (distance - accumulated) / cornerArc
        return getCornerPoint(
          left + width - radius,
          top + height - radius,
          radius,
          0,
          Math.PI / 2,
          arcProgress,
        )
      }
      accumulated += cornerArc

      if (straightWidth > 0 && distance <= accumulated + straightWidth) {
        const offset = (distance - accumulated) / straightWidth
        return { x: left + width - radius - offset * straightWidth, y: top + height }
      }
      accumulated += straightWidth

      if (distance <= accumulated + cornerArc) {
        const arcProgress = (distance - accumulated) / cornerArc
        return getCornerPoint(
          left + radius,
          top + height - radius,
          radius,
          Math.PI / 2,
          Math.PI / 2,
          arcProgress,
        )
      }
      accumulated += cornerArc

      if (straightHeight > 0 && distance <= accumulated + straightHeight) {
        const offset = (distance - accumulated) / straightHeight
        return { x: left, y: top + height - radius - offset * straightHeight }
      }
      accumulated += straightHeight

      const arcProgress = (distance - accumulated) / cornerArc
      return getCornerPoint(left + radius, top + radius, radius, Math.PI, Math.PI / 2, arcProgress)
    },
    [getCornerPoint],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current

    if (!canvas || !container) {
      return undefined
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return undefined
    }

    const octaves = 10
    const lacunarity = 1.6
    const gain = 0.7
    const amplitude = chaos
    const frequency = 10
    const baseFlatness = 0
    const displacement = 60
    const borderOffset = 60

    const updateSize = () => {
      const rect = container.getBoundingClientRect()
      const width = rect.width + borderOffset * 2
      const height = rect.height + borderOffset * 2
      const dpr = Math.min(window.devicePixelRatio || 1, 2)

      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.scale(dpr, dpr)

      return { width, height }
    }

    let { width, height } = updateSize()

    const drawElectricBorder = (currentTime: number) => {
      const deltaTime = lastFrameTimeRef.current === 0 ? 0 : (currentTime - lastFrameTimeRef.current) / 1000
      timeRef.current += deltaTime * speed
      lastFrameTimeRef.current = currentTime

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.scale(dpr, dpr)

      context.strokeStyle = color
      context.lineWidth = thickness
      context.lineCap = 'round'
      context.lineJoin = 'round'

      const left = borderOffset
      const top = borderOffset
      const borderWidth = width - 2 * borderOffset
      const borderHeight = height - 2 * borderOffset
      const maxRadius = Math.min(borderWidth, borderHeight) / 2
      const radius = Math.min(borderRadius, Math.max(0, maxRadius - 0.5))
      const approximatePerimeter = 2 * (borderWidth + borderHeight) + 2 * Math.PI * radius
      const sampleCount = Math.max(120, Math.floor(approximatePerimeter / 2))

      context.beginPath()

      for (let index = 0; index <= sampleCount; index += 1) {
        const progress = index / sampleCount
        const point = getRoundedRectPoint(progress, left, top, borderWidth, borderHeight, radius)

        const noiseX = octavedNoise(
          progress * 8,
          octaves,
          lacunarity,
          gain,
          amplitude,
          frequency,
          timeRef.current,
          0,
          baseFlatness,
        )
        const noiseY = octavedNoise(
          progress * 8,
          octaves,
          lacunarity,
          gain,
          amplitude,
          frequency,
          timeRef.current,
          1,
          baseFlatness,
        )

        const displacedX = point.x + noiseX * displacement
        const displacedY = point.y + noiseY * displacement

        if (index === 0) {
          context.moveTo(displacedX, displacedY)
        } else {
          context.lineTo(displacedX, displacedY)
        }
      }

      context.closePath()
      context.stroke()

      animationRef.current = window.requestAnimationFrame(drawElectricBorder)
    }

    const resizeObserver = new ResizeObserver(() => {
      const nextSize = updateSize()
      width = nextSize.width
      height = nextSize.height
    })

    resizeObserver.observe(container)
    animationRef.current = window.requestAnimationFrame(drawElectricBorder)

    return () => {
      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current)
      }
      resizeObserver.disconnect()
    }
  }, [borderRadius, chaos, color, getRoundedRectPoint, octavedNoise, speed, thickness])

  return (
    <div
      ref={containerRef}
      className={cn('relative isolate overflow-visible', className)}
      style={{ borderRadius, ...style }}
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2">
        <canvas ref={canvasRef} className="block" aria-hidden="true" />
      </div>

      <div className="pointer-events-none absolute inset-0 z-0 rounded-[inherit]">
        <div
          className="absolute inset-0 rounded-[inherit]"
          style={{ border: `${thickness}px solid ${hexToRgba(color, 0.6)}`, filter: 'blur(1px)' }}
        />
        <div
          className="absolute inset-0 rounded-[inherit]"
          style={{ border: `${thickness}px solid ${color}`, filter: 'blur(4px)' }}
        />
        <div
          className="absolute inset-0 -z-[1] scale-110 rounded-[inherit] opacity-30"
          style={{
            filter: 'blur(32px)',
            background: `linear-gradient(-30deg, ${color}, transparent, ${color})`,
          }}
        />
      </div>

      <div className="relative z-[1] rounded-[inherit]">{children}</div>
    </div>
  )
}

export const ElectricBorderWrapper = ElectricBorder

export default ElectricBorder
