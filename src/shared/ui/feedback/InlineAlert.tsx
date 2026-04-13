import type { PropsWithChildren } from 'react'
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import { cn } from '../../utils/cn'

type InlineAlertTone = 'info' | 'success' | 'warning' | 'error'

const toneConfig = {
  info: {
    icon: Info,
    className: 'border-nuba-brand/30 bg-nuba-brand/10 text-nuba-text',
  },
  success: {
    icon: CheckCircle2,
    className: 'border-nuba-check-in/30 bg-nuba-check-in/10 text-nuba-text',
  },
  warning: {
    icon: TriangleAlert,
    className: 'border-nuba-break/30 bg-nuba-break/10 text-nuba-text',
  },
  error: {
    icon: AlertCircle,
    className: 'border-nuba-error/30 bg-nuba-error/10 text-nuba-text',
  },
} satisfies Record<InlineAlertTone, { icon: typeof Info; className: string }>

type InlineAlertProps = PropsWithChildren<{
  title?: string
  tone?: InlineAlertTone
  className?: string
}>

export function InlineAlert({
  children,
  className,
  title,
  tone = 'info',
}: InlineAlertProps) {
  const Icon = toneConfig[tone].icon

  return (
    <div
      className={cn(
        'rounded-3xl border px-4 py-3 shadow-nuba',
        toneConfig[tone].className,
        className,
      )}
    >
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="space-y-1">
          {title ? <p className="text-sm font-semibold text-nuba-text">{title}</p> : null}
          <div className="text-sm leading-6 text-nuba-text-muted">{children}</div>
        </div>
      </div>
    </div>
  )
}
