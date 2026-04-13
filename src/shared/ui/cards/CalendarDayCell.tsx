import type { CalendarDay } from '../../types/statistics'
import { cn } from '../../utils/cn'
import { formatMinutesAsClock } from '../../utils/format'
import {
  getCalendarDayKind,
  getCalendarDayCompletion,
  getCalendarDayTone,
} from '../../../features/calendar/lib/calendarDayAppearance'

type CalendarDayCellProps = {
  dayNumber: number
  summary?: CalendarDay
  isSelected?: boolean
  isToday?: boolean
  onSelect?: () => void
}

const toneClasses = {
  empty:
    'border-white/[0.05] bg-[linear-gradient(180deg,rgba(255,255,255,0.028),rgba(18,24,33,0.56))] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:border-white/10 hover:bg-white/[0.05]',
  success:
    'border-nuba-success/16 bg-[radial-gradient(circle_at_top,rgba(74,222,128,0.12),transparent_58%),linear-gradient(180deg,rgba(74,222,128,0.045),rgba(18,24,33,0.88))] shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_14px_28px_-32px_rgba(74,222,128,0.18)] hover:border-nuba-success/24',
  warning:
    'border-nuba-break/16 bg-[radial-gradient(circle_at_top,rgba(255,209,102,0.11),transparent_58%),linear-gradient(180deg,rgba(255,209,102,0.04),rgba(18,24,33,0.88))] shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_14px_28px_-32px_rgba(255,209,102,0.16)] hover:border-nuba-break/24',
  danger:
    'border-nuba-check-out/15 bg-[radial-gradient(circle_at_top,rgba(255,122,122,0.1),transparent_58%),linear-gradient(180deg,rgba(255,122,122,0.038),rgba(18,24,33,0.9))] shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_14px_28px_-32px_rgba(255,122,122,0.14)] hover:border-nuba-check-out/22',
} as const

const progressClasses = {
  empty: 'bg-gradient-to-r from-white/18 to-white/6',
  success:
    'bg-gradient-to-r from-nuba-success via-nuba-check-in to-[#9AF4C6] shadow-[0_0_12px_rgba(74,222,128,0.45)]',
  warning:
    'bg-gradient-to-r from-nuba-break to-[#FFE3A1] shadow-[0_0_10px_rgba(255,209,102,0.35)]',
  danger:
    'bg-gradient-to-r from-nuba-check-out to-[#FFA29A] shadow-[0_0_10px_rgba(255,122,122,0.32)]',
} as const

export function CalendarDayCell({
  dayNumber,
  summary,
  isSelected,
  isToday,
  onSelect,
}: CalendarDayCellProps) {
  const tone = getCalendarDayTone(summary)
  const dayKind = getCalendarDayKind(summary)
  const progress = getCalendarDayCompletion(summary)
  const hasVisibleWork = Boolean(summary && (summary.workedMinutes > 0 || summary.hasOpenSession))
  const progressWidth = hasVisibleWork ? `${Math.max(progress * 100, 12)}%` : '0%'
  const workedLabel = hasVisibleWork && summary ? formatMinutesAsClock(summary.workedMinutes) : null
  const dayNumberClassName = cn(
    'relative z-10 truncate text-[14px] leading-none tracking-[-0.03em] drop-shadow-[0_1px_2px_rgba(11,15,20,0.46)] sm:text-[16px]',
    dayKind === 'workday' && 'font-semibold text-nuba-text',
    dayKind === 'weekend' && 'font-medium text-[rgb(148_165_184_/_0.86)]',
    dayKind === 'holiday' && 'font-semibold text-[rgb(232_212_154_/_0.92)]',
    dayKind === 'personal' && 'font-semibold text-[rgb(214_190_255_/_0.94)]',
  )

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-current={isToday ? 'date' : undefined}
      className={cn(
        'group relative isolate grid min-h-[63px] w-full grid-rows-[auto_1fr_auto] rounded-[18px] border px-2 pb-2 pt-1.5 text-left transition duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nuba-brand sm:min-h-[76px] sm:rounded-[20px] sm:px-2.5 sm:pb-2.5 sm:pt-2',
        toneClasses[tone],
        isSelected &&
          'border-white/10 bg-white/[0.03] shadow-[0_0_0_1px_rgba(230,237,243,0.04),0_18px_34px_-34px_rgba(11,15,20,0.72)]',
      )}
    >
      <div className="relative z-10 min-h-[1rem]">
        <span className={dayNumberClassName}>
          {dayNumber}
        </span>
      </div>

      <div className="relative z-10 mt-auto grid gap-1">
        <div className="flex min-h-[0.95rem] items-end">
          {workedLabel ? (
            <p
              className={cn(
                'whitespace-nowrap pb-0.5 font-mono text-[12px] font-semibold leading-none tracking-[-0.045em] tabular-nums sm:text-[14px]',
                'text-nuba-text/94',
              )}
            >
              {workedLabel}
            </p>
          ) : null}
        </div>

        <div className="min-h-[0.25rem] sm:min-h-[0.375rem]">
          {hasVisibleWork ? (
            <div className="h-1 overflow-hidden rounded-full bg-black/16 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] sm:h-1.5">
              <div
                className={cn(
                  'h-full rounded-full transition-[width,filter,opacity] duration-500 ease-out',
                  progressClasses[tone],
                )}
                style={{ width: progressWidth }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </button>
  )
}
