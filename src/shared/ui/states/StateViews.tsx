import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Inbox, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { PrimaryButton } from '../buttons/Button'

type BaseStateProps = {
  title: string
  description: string
  hint?: string
  icon?: LucideIcon
  action?: ReactNode
}

function StateFrame({
  action,
  description,
  hint,
  icon: Icon,
  title,
}: BaseStateProps) {
  return (
    <div className="flex min-h-[320px] items-center justify-center">
      <div className="max-w-lg rounded-[32px] border border-white/8 bg-nuba-surface/90 p-8 text-center shadow-nuba-elevated">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-white/5">
          {Icon ? <Icon className="h-6 w-6 text-nuba-brand" /> : null}
        </div>
        <div className="mt-5 space-y-2">
          <h2 className="text-xl font-semibold text-nuba-text">{title}</h2>
          <p className="text-sm leading-6 text-nuba-text-muted">{description}</p>
          {hint ? <p className="text-xs uppercase tracking-[0.18em] text-nuba-text-muted/70">{hint}</p> : null}
        </div>
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  )
}

export function LoadingState({
  title = 'Cargando',
  description = 'Recuperando información…',
}: Partial<BaseStateProps>) {
  return (
    <StateFrame
      icon={LoaderCircle}
      title={title}
      description={description}
      action={<LoaderCircle className="mx-auto h-5 w-5 animate-spin text-nuba-brand" />}
    />
  )
}

type ErrorStateProps = BaseStateProps & {
  onRetry?: () => void
}

export function ErrorState({
  action,
  description,
  hint,
  onRetry,
  title,
}: ErrorStateProps) {
  return (
    <StateFrame
      icon={AlertTriangle}
      title={title}
      description={description}
      hint={hint}
      action={
        action ??
        (onRetry ? <PrimaryButton onClick={onRetry}>Reintentar</PrimaryButton> : undefined)
      }
    />
  )
}

export function EmptyState({
  action,
  description,
  hint,
  icon = Inbox,
  title,
}: BaseStateProps) {
  return (
    <StateFrame
      icon={icon}
      title={title}
      description={description}
      hint={hint}
      action={action}
    />
  )
}
