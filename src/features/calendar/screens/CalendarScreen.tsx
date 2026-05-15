import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { eachDayOfInterval, endOfMonth, format, getDate, getISODay, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, PencilLine, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { calendarApi } from '../api/calendar.api'
import { calendarKeys } from '../api/calendar.keys'
import {
  getCalendarDayTone,
  getCalendarDayToneLabel,
} from '../lib/calendarDayAppearance'
import { WorkSessionEditorPanel } from '../components/WorkSessionEditorPanel'
import { useAuthSession } from '../../auth/AuthSessionProvider'
import { workSessionsApi } from '../../work-sessions/api/workSessions.api'
import { workSessionKeys } from '../../work-sessions/api/workSessions.keys'
import { CalendarDayCell } from '../../../shared/ui/cards/CalendarDayCell'
import { InlineAlert } from '../../../shared/ui/feedback/InlineAlert'
import { ErrorState, LoadingState } from '../../../shared/ui/states/StateViews'
import { isApiError } from '../../../shared/api/api-error'
import { cn } from '../../../shared/utils/cn'
import {
  formatMinutesCompact,
  formatTime,
  getStatusLabel,
} from '../../../shared/utils/format'

const weekdayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const toneBadgeClasses = {
  empty: 'border-white/10 bg-white/[0.04] text-nuba-text-muted/72',
  success: 'border-nuba-success/20 bg-nuba-success/[0.08] text-nuba-success',
  warning: 'border-nuba-break/20 bg-nuba-break/[0.08] text-nuba-break',
  danger: 'border-nuba-check-out/20 bg-nuba-check-out/[0.08] text-nuba-check-out',
} as const

const legendItems = [
  { label: 'Sin datos', className: 'bg-white/18' },
  { label: 'Cumplido', className: 'bg-[rgb(116_197_147_/_0.86)]' },
  { label: 'Cerca', className: 'bg-[rgb(222_191_108_/_0.84)]' },
  { label: 'Bajo', className: 'bg-[rgb(212_132_132_/_0.82)]' },
] as const

const capitalizeLabel = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value

const formatDayTitle = (isoDate: string) =>
  capitalizeLabel(
    format(new Date(`${isoDate}T12:00:00Z`), "EEEE d 'de' MMMM", {
      locale: es,
    }),
  )

const formatMetricMinutes = (minutes: number) => {
  if (minutes <= 0) {
    return '0m'
  }

  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60

  if (hours === 0) {
    return `${minutes}m`
  }

  if (remainder === 0) {
    return `${hours}h`
  }

  return `${hours}h ${remainder.toString().padStart(2, '0')}m`
}

export function CalendarScreen() {
  const auth = useAuthSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const [calendarNowMs, setCalendarNowMs] = useState(() => Date.now())
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null)
  const sheetTouchStartY = useRef<number | null>(null)
  const now = new Date()
  const todayIso = format(now, 'yyyy-MM-dd')
  const year = Number(searchParams.get('year') ?? now.getFullYear())
  const month = Number(searchParams.get('month') ?? now.getMonth() + 1)
  const selectedDate = searchParams.get('date')
  const currentMonthDate = new Date(year, month - 1, 1)

  const calendarQuery = useQuery({
    queryKey: calendarKeys.month(year, month),
    queryFn: () => calendarApi.getMonth(year, month),
    enabled: auth.isAuthenticated,
  })

  const changeMonth = (offset: number) => {
    const nextDate = new Date(year, month - 1 + offset, 1)

    setSelectedSessionId(null)
    setSaveFeedback(null)
    startTransition(() => {
      setSearchParams({
        year: String(nextDate.getFullYear()),
        month: String(nextDate.getMonth() + 1),
      })
    })
  }

  const setSelectedDate = useCallback((nextDate: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams)

    if (nextDate) {
      nextSearchParams.set('date', nextDate)
    } else {
      nextSearchParams.delete('date')
    }

    setSelectedSessionId(null)
    setSaveFeedback(null)
    startTransition(() => {
      setSearchParams(nextSearchParams)
    })
  }, [searchParams, setSearchParams])

  const firstDay = startOfMonth(currentMonthDate)
  const lastDay = endOfMonth(currentMonthDate)
  const days = eachDayOfInterval({ start: firstDay, end: lastDay })
  const leadingEmptyCells = getISODay(firstDay) - 1
  const trailingEmptyCells = (7 - ((leadingEmptyCells + days.length) % 7)) % 7
  const calendarSlots = [
    ...Array.from({ length: leadingEmptyCells }, () => null as Date | null),
    ...days,
    ...Array.from({ length: trailingEmptyCells }, () => null as Date | null),
  ]
  const hasRunningCalendarDay =
    calendarQuery.data?.days.some(
      (day) => day.hasOpenSession && day.latestStatus === 'ACTIVE',
    ) ?? false
  const liveCalendarDays = useMemo(() => {
    const dataUpdatedAt = calendarQuery.dataUpdatedAt || calendarNowMs
    const elapsedMinutes = Math.max(0, Math.floor((calendarNowMs - dataUpdatedAt) / 60_000))

    return (
      calendarQuery.data?.days.map((day) => {
        if (!day.hasOpenSession || day.latestStatus !== 'ACTIVE') {
          return day
        }

        const workedMinutes = day.workedMinutes + elapsedMinutes

        return {
          ...day,
          workedMinutes,
          remainingMinutes: Math.max(0, day.targetMinutes - workedMinutes),
          extraMinutes: Math.max(0, workedMinutes - day.targetMinutes),
        }
      }) ?? []
    )
  }, [calendarNowMs, calendarQuery.data?.days, calendarQuery.dataUpdatedAt])
  const summaryByDate = new Map(liveCalendarDays.map((day) => [day.date, day]))
  const selectedSummary = selectedDate ? summaryByDate.get(selectedDate) : undefined
  const selectedTone = getCalendarDayTone(selectedSummary)
  const monthTitle = capitalizeLabel(format(currentMonthDate, 'MMMM yyyy', { locale: es }))
  const selectedDateTitle = selectedDate ? formatDayTitle(selectedDate) : null
  const selectedToneLabel =
    selectedSummary && (selectedSummary.workedMinutes > 0 || selectedSummary.hasOpenSession)
      ? getCalendarDayToneLabel(selectedTone)
      : null
  const selectedMetaLabel = selectedSummary?.hasOpenSession
    ? 'En curso'
    : selectedDate === todayIso
      ? 'Hoy'
      : null

  const daySessionsQuery = useQuery({
    queryKey: workSessionKeys.history({
      from: selectedDate ?? '',
      to: selectedDate ?? '',
      page: 0,
      size: 24,
    }),
    queryFn: () =>
      workSessionsApi.getHistory({
        from: selectedDate ?? undefined,
        to: selectedDate ?? undefined,
        page: 0,
        size: 24,
      }),
    enabled: auth.isAuthenticated && Boolean(selectedDate),
  })
  const daySessions = daySessionsQuery.data?.items ?? []

  useEffect(() => {
    if (!hasRunningCalendarDay) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setCalendarNowMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [hasRunningCalendarDay])

  useEffect(() => {
    if (!selectedDate) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedDate(null)
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [selectedDate, setSelectedDate])

  return (
    <div className="relative flex flex-col gap-8 pb-28 after:pointer-events-none after:absolute after:inset-x-[9%] after:bottom-16 after:h-24 after:bg-[radial-gradient(ellipse_at_center,_rgb(255_255_255_/_0.045),_transparent_72%)] after:blur-3xl lg:pb-12 lg:after:bottom-4">
      <section className="rounded-[28px] border border-white/[0.07] bg-[linear-gradient(180deg,_rgb(255_255_255_/_0.03),_rgb(18_24_33_/_0.08)_40%,_rgb(11_15_20_/_0.02)_100%)] px-2.5 pb-5 pt-3 sm:px-3.5 sm:pb-6 sm:pt-4 shadow-[0_28px_68px_-44px_rgb(0_0_0_/_0.9),0_0_0_1px_rgb(255_255_255_/_0.02)]">
        <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
          <h2 className="text-lg font-semibold tracking-[-0.04em] text-nuba-text sm:text-[1.35rem]">
            {monthTitle}
          </h2>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              aria-label="Mes anterior"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/8 bg-transparent text-nuba-text-muted/72 transition hover:border-white/12 hover:bg-white/[0.035] hover:text-nuba-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nuba-brand sm:h-9 sm:w-9"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => changeMonth(1)}
              aria-label="Mes siguiente"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/8 bg-transparent text-nuba-text-muted/72 transition hover:border-white/12 hover:bg-white/[0.035] hover:text-nuba-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nuba-brand sm:h-9 sm:w-9"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {calendarQuery.isLoading && !calendarQuery.data ? (
          <LoadingState
            title="Cargando mes"
            description="Sincronizando jornadas y objetivos."
          />
        ) : null}

        {calendarQuery.isError && !calendarQuery.data ? (
          <ErrorState
            title="No pudimos cargar el calendario"
            description={
              isApiError(calendarQuery.error)
                ? calendarQuery.error.message
                : 'Verifica el mes solicitado y vuelve a intentarlo.'
            }
            onRetry={() => void calendarQuery.refetch()}
          />
        ) : null}

        {calendarQuery.data ? (
          <>
            <div className="mb-3 grid grid-cols-7 gap-1 px-0.5 sm:mb-3.5 sm:gap-1.5">
              {weekdayLabels.map((weekday) => (
                <div
                  key={weekday}
                  className="text-center text-[9px] font-semibold uppercase tracking-[0.2em] text-nuba-text-muted/50 sm:text-[10px]"
                >
                  {weekday}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-x-1 gap-y-1.5 sm:gap-x-1.5 sm:gap-y-2">
              {calendarSlots.map((day, slotIndex) => {
                if (!day) {
                  return (
                    <div
                      key={`empty-${slotIndex}`}
                      aria-hidden="true"
                      className="min-h-[63px] sm:min-h-[76px]"
                    />
                  )
                }

                const isoDate = format(day, 'yyyy-MM-dd')

                return (
                  <CalendarDayCell
                    key={isoDate}
                    dayNumber={getDate(day)}
                    summary={summaryByDate.get(isoDate)}
                    isToday={isoDate === todayIso}
                    isSelected={selectedDate === isoDate}
                    onSelect={() => setSelectedDate(selectedDate === isoDate ? null : isoDate)}
                  />
                )
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[9px] font-medium tracking-[0.04em] text-nuba-text-muted/60 sm:text-[10px]">
              {legendItems.map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span
                    className={cn('h-1.5 w-1.5 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.04)]', item.className)}
                    aria-hidden="true"
                  />
                  {item.label}
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <AnimatePresence>
        {selectedDate ? (
          <>
            <motion.button
              type="button"
              aria-label="Cerrar detalle del día"
              onClick={() => setSelectedDate(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="fixed inset-0 z-[60] bg-[rgb(8_11_16_/_0.48)] backdrop-blur-[6px]"
            />

            <motion.section
              role="dialog"
              aria-modal="true"
              aria-label={selectedDateTitle ?? 'Detalle del día'}
              initial={{ y: '100%', opacity: 0.96 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0.96 }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              className="fixed inset-x-0 bottom-0 z-[70] mx-auto flex w-full max-w-3xl flex-col rounded-t-[32px] border border-white/[0.08] bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.98),_rgb(18_24_33_/_0.98))] shadow-[0_-30px_78px_-36px_rgba(0,0,0,0.92)] backdrop-blur-[20px] lg:bottom-4 lg:left-1/2 lg:w-[min(42rem,calc(100vw-2rem))] lg:-translate-x-1/2 lg:rounded-[32px]"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
            >
              <div
                className="flex justify-center px-4 pt-2.5"
                onTouchStart={(event) => {
                  sheetTouchStartY.current = event.touches[0]?.clientY ?? null
                }}
                onTouchEnd={(event) => {
                  const startY = sheetTouchStartY.current
                  if (startY == null) {
                    return
                  }

                  const endY = event.changedTouches[0]?.clientY ?? startY
                  if (endY - startY > 72) {
                    setSelectedDate(null)
                  }
                  sheetTouchStartY.current = null
                }}
              >
                <span className="h-1.5 w-12 rounded-full bg-white/10" aria-hidden="true" />
              </div>

              <div className="max-h-[68svh] overflow-y-auto px-4 pb-4 pt-2 sm:max-h-[65svh] sm:px-5 sm:pb-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {selectedToneLabel ? (
                        <span
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]',
                            toneBadgeClasses[selectedTone],
                          )}
                        >
                          {selectedToneLabel}
                        </span>
                      ) : null}

                      {selectedMetaLabel ? (
                        <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-nuba-text-muted/78">
                          {selectedMetaLabel}
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-[1.02rem] font-semibold tracking-[-0.04em] text-nuba-text sm:text-[1.12rem]">
                        {selectedDateTitle}
                      </h3>
                      {selectedSummary?.specialDayName ? (
                        <p className="text-sm leading-5 text-nuba-text-muted/74">
                          {selectedSummary.specialDayName}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedDate(null)}
                    aria-label="Cerrar detalle del día"
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] text-nuba-text-muted/78 transition hover:border-white/12 hover:bg-white/[0.06] hover:text-nuba-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nuba-brand"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-nuba-text-muted/54">
                      Trabajo
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-nuba-text sm:text-[15px]">
                      {formatMetricMinutes(selectedSummary?.workedMinutes ?? 0)}
                    </p>
                  </div>

                  <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-nuba-text-muted/54">
                      Objetivo
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-nuba-text sm:text-[15px]">
                      {formatMetricMinutes(selectedSummary?.targetMinutes ?? 0)}
                    </p>
                  </div>

                  <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-nuba-text-muted/54">
                      Comida
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-nuba-text sm:text-[15px]">
                      {formatMetricMinutes(selectedSummary?.breakMinutes ?? 0)}
                    </p>
                  </div>

                  <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-nuba-text-muted/54">
                      Salidas
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-nuba-text sm:text-[15px]">
                      {selectedSummary?.outingsCount ?? 0}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {saveFeedback ? (
                    <InlineAlert tone="success" title="Jornada actualizada">
                      {saveFeedback}
                    </InlineAlert>
                  ) : null}

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-nuba-text">Sesiones del día</p>
                      <p className="text-xs text-nuba-text-muted/70">
                        Revisa cada bloque y ajusta entrada, descanso o salida si hace falta.
                      </p>
                    </div>
                    {daySessionsQuery.isFetching && !daySessionsQuery.isLoading ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-nuba-text-muted/82">
                        Sincronizando
                      </span>
                    ) : null}
                  </div>

                  {daySessionsQuery.isLoading ? (
                    <div className="rounded-[24px] border border-white/[0.06] bg-white/[0.03] px-4 py-5 text-sm text-nuba-text-muted/78">
                      Cargando las sesiones de esta fecha.
                    </div>
                  ) : null}

                  {daySessionsQuery.isError ? (
                    <InlineAlert tone="error" title="No pudimos cargar las sesiones">
                      {isApiError(daySessionsQuery.error)
                        ? daySessionsQuery.error.message
                        : 'Inténtalo de nuevo en unos segundos.'}
                    </InlineAlert>
                  ) : null}

                  {!daySessionsQuery.isLoading &&
                  !daySessionsQuery.isError &&
                  daySessions.length === 0 ? (
                    <InlineAlert tone="info" title="Sin fichajes ese día">
                      No hay sesiones registradas en esta fecha todavía.
                    </InlineAlert>
                  ) : null}

                  {daySessions.length ? (
                    <div className="space-y-3">
                      {daySessions.map((session) => {
                        const isActiveSession = selectedSessionId === session.id

                        return (
                          <button
                            key={session.id}
                            type="button"
                            onClick={() => {
                              setSelectedSessionId(session.id)
                              setSaveFeedback(null)
                            }}
                            className={cn(
                              'w-full rounded-[24px] border px-4 py-3 text-left transition duration-200',
                              isActiveSession
                                ? 'border-nuba-brand/28 bg-nuba-brand/[0.08] shadow-[0_18px_46px_-34px_rgb(124_158_255_/_0.85)]'
                                : 'border-white/[0.06] bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.22),_rgb(18_24_33_/_0.42))] hover:border-white/12 hover:bg-white/[0.04]',
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-nuba-text-muted/82">
                                    {getStatusLabel(session.status)}
                                  </span>
                                  {session.autoCloseNotice ? (
                                    <span className="rounded-full border border-nuba-break/24 bg-nuba-break/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-nuba-break">
                                      Autocompletada
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-2 text-[1rem] font-semibold tracking-[-0.03em] text-nuba-text">
                                  {formatTime(session.startTime)} {session.endTime ? `- ${formatTime(session.endTime)}` : '- abierta'}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-nuba-text-muted/72">
                                  {session.reason
                                    ? session.reason
                                    : session.endTime
                                      ? 'Sin incidencias registradas.'
                                      : 'Esta jornada sigue abierta y puede corregirse desde aquí.'}
                                </p>
                              </div>

                              <div className="shrink-0 text-right">
                                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-nuba-text-muted/50">
                                  Neto
                                </p>
                                <p className="mt-1 text-sm font-semibold text-nuba-text">
                                  {formatMinutesCompact(session.workedMinutes ?? 0)}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-nuba-brand">
                              <PencilLine className="h-3.5 w-3.5" />
                              Ajustar tiempos
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ) : null}

                  {selectedSessionId ? (
                    <div className="rounded-[28px] border border-white/[0.06] bg-[linear-gradient(180deg,_rgb(20_27_37_/_0.94),_rgb(15_20_28_/_0.98))] p-4 shadow-[0_24px_56px_-42px_rgb(0_0_0_/_0.92)]">
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-nuba-text">Editor de jornada</p>
                        <p className="text-xs text-nuba-text-muted/70">
                          Todo lo que cambies se recalculará en Home, calendario e insights.
                        </p>
                      </div>

                      <WorkSessionEditorPanel
                        date={selectedDate}
                        sessionId={selectedSessionId}
                        onCancel={() => setSelectedSessionId(null)}
                        onSaved={() => {
                          setSaveFeedback(
                            'Los tiempos ya están corregidos y el resumen del día se ha recalculado.',
                          )
                          setSelectedSessionId(null)
                        }}
                      />
                    </div>
                  ) : null}
                </div>

              </div>
            </motion.section>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
