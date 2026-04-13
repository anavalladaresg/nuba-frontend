import { Link } from 'react-router-dom'
import { ArrowUpRight, Clock3 } from 'lucide-react'
import type { WorkSession } from '../../types/work-session'
import { formatDateShort, formatMinutesCompact, formatTime, getStatusLabel } from '../../utils/format'
import { cn } from '../../utils/cn'

type SessionCardProps = {
  session: WorkSession
  to?: string
}

const statusTone: Record<WorkSession['status'], string> = {
  ACTIVE: 'border-nuba-check-in/30 bg-nuba-check-in/10 text-nuba-check-in',
  PAUSED: 'border-nuba-break/30 bg-nuba-break/10 text-nuba-break',
  COMPLETED: 'border-white/10 bg-white/5 text-nuba-text',
  EDITED: 'border-nuba-overtime/30 bg-nuba-overtime/10 text-nuba-overtime',
}

export function SessionCard({ session, to }: SessionCardProps) {
  const content = (
    <div className="rounded-[28px] border border-white/8 bg-nuba-surface-elevated/80 p-5 transition hover:border-nuba-brand/30 hover:bg-nuba-surface-elevated">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm text-nuba-text-muted">{formatDateShort(session.startTime)}</p>
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-nuba-brand" />
            <h3 className="text-lg font-semibold text-nuba-text">
              {formatTime(session.startTime)} {session.endTime ? `- ${formatTime(session.endTime)}` : '- abierta'}
            </h3>
          </div>
        </div>

        <span className={cn('rounded-full border px-3 py-1 text-xs font-medium', statusTone[session.status])}>
          {getStatusLabel(session.status)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-nuba-text-muted/70">
            Trabajo
          </p>
          <p className="mt-1 text-sm font-medium text-nuba-text">
            {formatMinutesCompact(session.workedMinutes ?? 0)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-nuba-text-muted/70">
            Pausas
          </p>
          <p className="mt-1 text-sm font-medium text-nuba-text">
            {formatMinutesCompact(session.breakMinutes ?? 0)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-nuba-text-muted/70">
            Notas
          </p>
          <p className="mt-1 text-sm text-nuba-text-muted">
            {session.notes || 'Sin observaciones'}
          </p>
        </div>
      </div>
    </div>
  )

  if (!to) {
    return content
  }

  return (
    <Link to={to} className="group block">
      <div className="relative">
        {content}
        <ArrowUpRight className="absolute right-4 top-4 h-4 w-4 text-nuba-text-muted transition group-hover:text-nuba-brand" />
      </div>
    </Link>
  )
}
