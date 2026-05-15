import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  CalendarDays,
  Coffee,
  LoaderCircle,
  Pause,
  Play,
  Square,
  X,
  type LucideIcon,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useTodayWorkSessionQuery } from '../hooks/useTodayWorkSessionQuery'
import { useLiveTodayMetrics } from '../hooks/useLiveTodayMetrics'
import { useSessionActions } from '../hooks/useSessionActions'
import { useCatchUpTimer } from '../hooks/useCatchUpTimer'
import type { AppShellOutletContext } from '../../../app/layout/AppShell'
import { type SessionVisualState } from '../../../shared/ui/react-bits/SessionStatusFrame'
import { CountUp } from '../../../shared/ui/react-bits/CountUp'
import { ElectricBorder } from '../../../shared/ui/react-bits/ElectricBorder'
import { PrimaryButton } from '../../../shared/ui/buttons/Button'
import { ErrorState, LoadingState } from '../../../shared/ui/states/StateViews'
import { InlineAlert } from '../../../shared/ui/feedback/InlineAlert'
import {
  formatBusinessDateIso,
  formatClockFromSeconds,
  formatDateShort,
  formatMinutesCompact,
  formatTime,
} from '../../../shared/utils/format'
import { isApiError } from '../../../shared/api/api-error'
import { cn } from '../../../shared/utils/cn'

const getHomeVisualState = (
  hasOpenSession: boolean,
  paused: boolean,
  sessionCount: number,
): SessionVisualState => {
  if (hasOpenSession && paused) {
    return 'paused'
  }

  if (hasOpenSession) {
    return 'started'
  }

  if (sessionCount > 0) {
    return 'completed'
  }

  return 'idle'
}

const formatMinutesTight = (minutes: number) => {
  const absoluteMinutes = Math.max(0, Math.abs(minutes))
  const hours = Math.floor(absoluteMinutes / 60)
  const remainder = absoluteMinutes % 60

  if (hours === 0) {
    return `${absoluteMinutes}m`
  }

  if (remainder === 0) {
    return `${hours}h`
  }

  return `${hours}h ${remainder.toString().padStart(2, '0')}m`
}

type InlineActionTone = 'brand' | 'danger'

type InlineAction = {
  icon: LucideIcon
  label: string
  loading: boolean
  onClick: () => void
  tone?: InlineActionTone
}

type MetricChipTone = 'brand' | 'break' | 'neutral'

type MetricChipProps = {
  icon: LucideIcon
  label: string
  tone?: MetricChipTone
}

const metricChipToneClassName: Record<MetricChipTone, string> = {
  brand: 'border-nuba-brand/16 bg-nuba-brand/[0.07] text-nuba-brand',
  break: 'border-nuba-break/18 bg-nuba-break/[0.09] text-nuba-break',
  neutral: 'border-white/[0.05] bg-white/[0.03] text-nuba-text-muted/86',
}

function MetricChip({
  icon: Icon,
  label,
  tone = 'neutral',
}: MetricChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium tracking-[0.03em] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.03)] backdrop-blur-[10px]',
        metricChipToneClassName[tone],
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

export function HomeScreen() {
  const navigate = useNavigate()
  const { setHomeSummaryMeta } = useOutletContext<AppShellOutletContext>()
  const todayQuery = useTodayWorkSessionQuery()
  const actions = useSessionActions()
  const [isStopConfirmOpen, setIsStopConfirmOpen] = useState(false)

  const liveMetrics = useLiveTodayMetrics(
    todayQuery.data,
    todayQuery.dataUpdatedAt,
  )
  const isWorkedTimerLive =
    (todayQuery.data?.summary.hasOpenSession ?? false) && !(todayQuery.data?.paused ?? false)
  const workedTimer = useCatchUpTimer({
    enabled: isWorkedTimerLive,
    value: liveMetrics.liveWorkedSeconds,
  })

  const today = todayQuery.data
  const carryOverSession = today?.carryOverSession ?? null
  const autoClosedPreviousSession = actions.startMutation.data?.autoClosedPreviousSession ?? null
  const hasCarryOverSession = Boolean(carryOverSession)
  const carryOverDate = carryOverSession
    ? formatBusinessDateIso(carryOverSession.startTime)
    : null
  const workedTodayMinutes = Math.floor(liveMetrics.liveWorkedSeconds / 60)
  const headerSummaryMeta = today
    ? hasCarryOverSession
      ? `Pendiente · ${formatDateShort(carryOverSession?.startTime ?? today.summary.date)}`
      : today.summary.hasOpenSession || today.summary.sessionCount > 0
      ? `Hoy · ${formatMinutesTight(workedTodayMinutes)} trabajados`
      : 'Hoy · listo para empezar'
    : null

  useEffect(() => {
    setHomeSummaryMeta(headerSummaryMeta)
  }, [headerSummaryMeta, setHomeSummaryMeta])

  useEffect(
    () => () => {
      setHomeSummaryMeta(null)
    },
    [setHomeSummaryMeta],
  )
  const showStopConfirm = isStopConfirmOpen && (today?.summary.hasOpenSession ?? false)

  useEffect(() => {
    if (!showStopConfirm) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsStopConfirmOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showStopConfirm])

  if (todayQuery.isLoading && !today) {
    return (
      <LoadingState
        title="Cargando Home de fichaje"
        description="Recuperando el resumen del día, sesiones y timeline de hoy."
      />
    )
  }

  if (todayQuery.isError && !today) {
    return (
      <ErrorState
        title="No pudimos cargar la jornada de hoy"
        description={
          isApiError(todayQuery.error)
            ? todayQuery.error.message
            : 'Intenta recargar para reconstruir el resumen local del día.'
        }
        onRetry={() => void todayQuery.refetch()}
      />
    )
  }

  if (!today) {
    return null
  }

  const visualState = getHomeVisualState(
    today.summary.hasOpenSession,
    today.paused,
    today.summary.sessionCount,
  )
  const hasRunningSession = today.summary.hasOpenSession && !today.paused
  const hasPausedSession = today.summary.hasOpenSession && today.paused
  const isLunchPause =
    hasPausedSession && today.activeBreak?.breakType === 'LUNCH'

  const workedTodayClock = formatClockFromSeconds(workedTimer.displayTime)
  const lastSession = today.sessions.at(-1) ?? null
  const latestAutoClosedSession =
    lastSession?.autoCloseNotice && lastSession.reason?.toLowerCase().includes('cierre automático')
      ? lastSession.autoCloseNotice
      : null
  const homeAutoCloseNotice = autoClosedPreviousSession ?? latestAutoClosedSession
  const estimatedTime =
    today.summary.projectedEndAt
      ? formatTime(today.summary.projectedEndAt)
      : lastSession?.endTime
        ? formatTime(lastSession.endTime)
        : '--:--'
  const mealMinutes = Math.floor(liveMetrics.liveBreakSeconds / 60)
  const mealInlineLabel = `${formatMinutesTight(mealMinutes)} comida`
  const mealChipLabel = `Comida ${formatMinutesTight(mealMinutes)}`
  const dayPlanLabel =
    today.summary.targetMinutes === 0
      ? 'Jornada flexible'
      : `Jornada ${formatMinutesTight(today.summary.targetMinutes)}`
  const entryReferenceTime =
    carryOverSession?.startTime ?? today.sessions.at(0)?.startTime ?? null
  const entryChipLabel = entryReferenceTime
    ? `Entrada ${formatTime(entryReferenceTime)}`
    : null
  const outingsCount = today.summary.outingsCount ?? 0
  const outingsInlineLabel = `${outingsCount} salidas`
  const outingsChipLabel = `Salidas ${outingsCount}`
  const contextHeadline = today.summary.hasOpenSession
    ? hasCarryOverSession
      ? `Jornada pendiente del ${formatDateShort(carryOverSession?.startTime ?? today.summary.date)}`
      : today.paused
        ? isLunchPause
          ? 'En pausa · comida'
          : 'Jornada en pausa'
        : estimatedTime === '--:--'
          ? 'Jornada en marcha'
          : `Salida estimada ${estimatedTime}`
    : hasCarryOverSession
      ? `Jornada pendiente del ${formatDateShort(carryOverSession?.startTime ?? today.summary.date)}`
      : today.summary.sessionCount > 0
        ? estimatedTime === '--:--'
          ? 'Jornada cerrada'
          : `Terminaste a las ${estimatedTime}`
        : dayPlanLabel
  const contextDetail = actions.hasPendingAction
    ? 'Actualizando el estado de tu jornada.'
    : hasCarryOverSession
      ? 'Antes de fichar hoy, revisa esa jornada en Calendario o activa el cierre automático en Ajustes.'
      : today.summary.hasOpenSession
      ? today.paused
        ? isLunchPause
          ? 'El tiempo trabajado está detenido. Reanuda cuando vuelvas.'
          : 'La jornada está detenida hasta que la reanudes.'
        : today.summary.extraMinutes > 0
          ? `Vas ${formatMinutesTight(today.summary.extraMinutes)} por encima`
          : `Te quedan ${formatMinutesCompact(today.summary.remainingMinutes)}`
      : today.summary.sessionCount > 0
        ? today.summary.targetMinutes === 0
          ? 'Jornada registrada.'
          : today.summary.extraMinutes > 0
            ? `Has sumado ${formatMinutesTight(today.summary.extraMinutes)} extra`
            : today.summary.remainingMinutes > 0
              ? `Te faltaron ${formatMinutesCompact(today.summary.remainingMinutes)}`
              : 'Jornada cumplida.'
        : today.summary.targetMinutes === 0
          ? 'Hoy fichas solo si lo necesitas.'
          : 'Todo listo para empezar.'
  const statusChipLabel = today.summary.hasOpenSession
    ? hasCarryOverSession
      ? 'Pendiente'
      : today.paused
        ? isLunchPause
          ? 'Pausa comida'
          : 'En pausa'
        : 'Trabajando'
    : hasCarryOverSession
      ? 'Pendiente'
      : today.summary.sessionCount > 0
        ? 'Completada'
        : 'Sin iniciar'
  const specialDayLabel =
    today.summary.specialDayName ||
    (today.summary.holiday
      ? 'Festivo'
      : today.summary.weekend
        ? 'Fin de semana'
        : today.summary.targetMinutes === 0
          ? 'Jornada flexible'
          : null)
  const compactStatusClassName = cn(
    'inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[9.5px] font-medium tracking-[0.01em]',
    visualState === 'started' && 'border-nuba-check-in/16 bg-nuba-check-in/[0.05] text-nuba-check-in',
    visualState === 'paused' &&
      'border-[rgb(207_176_113_/_0.16)] bg-[rgb(207_176_113_/_0.06)] text-[rgb(218_190_132_/_0.92)]',
    visualState === 'completed' &&
      'border-nuba-check-out/14 bg-nuba-check-out/[0.04] text-nuba-check-out',
    visualState === 'idle' && 'border-nuba-brand/16 bg-nuba-brand/[0.05] text-nuba-brand',
  )
  const circleSurfaceClassName = cn(
    'bg-[radial-gradient(circle_at_top,_rgb(255_255_255_/_0.07),_transparent_42%),radial-gradient(circle_at_50%_66%,_rgb(124_158_255_/_0.1),_transparent_58%),linear-gradient(180deg,_rgb(22_29_40_/_0.97),_rgb(10_14_22_/_0.99))]',
    visualState === 'started' &&
      'bg-[radial-gradient(circle_at_top,_rgb(255_255_255_/_0.07),_transparent_42%),radial-gradient(circle_at_50%_66%,_rgb(103_214_165_/_0.11),_transparent_58%),linear-gradient(180deg,_rgb(22_29_40_/_0.97),_rgb(10_14_22_/_0.99))]',
    visualState === 'paused' &&
      'bg-[radial-gradient(circle_at_top,_rgb(255_255_255_/_0.045),_transparent_42%),radial-gradient(circle_at_50%_66%,_rgb(196_166_104_/_0.075),_transparent_60%),linear-gradient(180deg,_rgb(20_25_33_/_0.97),_rgb(10_13_20_/_0.99))]',
    visualState === 'completed' &&
      'bg-[radial-gradient(circle_at_top,_rgb(255_255_255_/_0.07),_transparent_42%),radial-gradient(circle_at_50%_66%,_rgb(124_158_255_/_0.08),_transparent_58%),linear-gradient(180deg,_rgb(22_29_40_/_0.97),_rgb(10_14_22_/_0.99))]',
  )
  const circleClassName = cn(
    'shadow-[0_0_30px_rgb(124_158_255_/_0.05)]',
    visualState === 'started' && 'shadow-[0_0_38px_rgb(119_206_161_/_0.06)]',
    visualState === 'paused' && 'shadow-[0_0_28px_rgb(196_166_104_/_0.045)]',
    visualState === 'completed' && 'shadow-[0_0_34px_rgb(124_158_255_/_0.05)]',
  )
  const circlePulseClassName = cn(
    'bg-[radial-gradient(circle_at_center,_rgb(124_158_255_/_0.14),_transparent_62%)]',
    visualState === 'started' &&
      'bg-[radial-gradient(circle_at_center,_rgb(119_206_161_/_0.18),_transparent_62%)]',
    visualState === 'paused' &&
      'bg-[radial-gradient(circle_at_center,_rgb(196_166_104_/_0.09),_transparent_66%)]',
    visualState === 'completed' &&
      'bg-[radial-gradient(circle_at_center,_rgb(124_158_255_/_0.14),_transparent_62%)]',
  )
  const electricColor =
    visualState === 'started'
      ? 'rgba(126, 214, 168, 0.64)'
      : visualState === 'paused'
        ? 'rgba(196, 166, 104, 0.4)'
        : 'rgba(124, 158, 255, 0.52)'
  const primaryAction = !today.summary.hasOpenSession
    ? hasCarryOverSession && carryOverDate
      ? {
          icon: CalendarDays,
          label: 'Revisar jornada pendiente',
          loading: false,
          onClick: () => {
            const carryOverDateValue = new Date(`${carryOverDate}T12:00:00Z`)
            navigate(
              `/calendar?year=${carryOverDateValue.getUTCFullYear()}&month=${
                carryOverDateValue.getUTCMonth() + 1
              }&date=${carryOverDate}`,
            )
          },
        }
      : {
          icon: Play,
          label: today.summary.sessionCount > 0 ? 'Iniciar otra sesión' : 'Fichar entrada',
          loading: actions.startMutation.isPending,
          onClick: () => actions.startMutation.mutate(),
        }
    : today.paused
      ? {
          icon: Play,
          label: 'Reanudar',
          loading: actions.resumeMutation.isPending,
          onClick: () => actions.resumeMutation.mutate(),
        }
      : {
          icon: Coffee,
          label: 'Pausa comida',
          loading: actions.pauseMutation.isPending,
          onClick: () => actions.pauseMutation.mutate('LUNCH'),
        }
  const secondaryActions: InlineAction[] = []

  if (today.summary.hasOpenSession && !today.paused) {
    secondaryActions.push(
      {
        icon: ArrowUpRight,
        label: 'Salida +1',
        loading: actions.registerOutingMutation.isPending,
        onClick: () => actions.registerOutingMutation.mutate(),
        tone: 'brand',
      },
      {
        icon: Square,
        label: 'Finalizar',
        loading: actions.stopMutation.isPending,
        onClick: () => setIsStopConfirmOpen(true),
        tone: 'danger',
      },
    )
  }

  if (today.summary.hasOpenSession && today.paused) {
    secondaryActions.push({
      icon: Square,
      label: 'Finalizar jornada',
      loading: actions.stopMutation.isPending,
      onClick: () => setIsStopConfirmOpen(true),
      tone: 'danger',
    })
  }

  const primaryActionClassName = cn(
    'min-h-[3rem] rounded-[20px] border px-[1rem] py-[0.8rem] text-[0.9rem] font-semibold tracking-[0.012em] text-nuba-bg shadow-[inset_0_1px_0_rgb(255_255_255_/_0.18),0_14px_28px_-20px_rgb(0_0_0_/_0.72)] transition duration-200 active:scale-[0.985]',
    !today.summary.hasOpenSession &&
      'border-nuba-brand/48 bg-[linear-gradient(135deg,_rgb(124_158_255_/_0.96),_rgb(61_89_213_/_0.94))]',
    today.summary.hasOpenSession &&
      !today.paused &&
      'border-nuba-break/50 bg-[linear-gradient(135deg,_rgb(255_209_102_/_0.96),_rgb(223_147_38_/_0.94))]',
    today.paused &&
      'border-nuba-check-in/48 bg-[linear-gradient(135deg,_rgb(103_214_165_/_0.94),_rgb(50_83_198_/_0.96))]',
  )
  const primaryActionHaloClassName = cn(
    !today.summary.hasOpenSession &&
      'shadow-[0_0_0_1px_rgb(124_158_255_/_0.2),0_0_24px_rgb(124_158_255_/_0.26)]',
    today.summary.hasOpenSession &&
      !today.paused &&
      'shadow-[0_0_0_1px_rgb(255_209_102_/_0.2),0_0_24px_rgb(255_209_102_/_0.24)]',
    today.paused &&
      'shadow-[0_0_0_1px_rgb(103_214_165_/_0.2),0_0_24px_rgb(103_214_165_/_0.24)]',
  )
  const heroFieldClassName = cn(
    'bg-[radial-gradient(ellipse_at_50%_70%,_rgb(124_158_255_/_0.2)_0%,_rgb(124_158_255_/_0.09)_30%,_transparent_72%),radial-gradient(ellipse_at_50%_24%,_rgb(124_158_255_/_0.04)_0%,_transparent_56%)]',
    visualState === 'started' &&
      'bg-[radial-gradient(ellipse_at_50%_70%,_rgb(103_214_165_/_0.2)_0%,_rgb(103_214_165_/_0.09)_30%,_transparent_72%),radial-gradient(ellipse_at_50%_24%,_rgb(103_214_165_/_0.04)_0%,_transparent_56%)]',
    visualState === 'paused' &&
      'bg-[radial-gradient(ellipse_at_50%_70%,_rgb(196_166_104_/_0.11)_0%,_rgb(196_166_104_/_0.05)_28%,_transparent_72%),radial-gradient(ellipse_at_50%_24%,_rgb(196_166_104_/_0.025)_0%,_transparent_56%)]',
    visualState === 'completed' &&
      'bg-[radial-gradient(ellipse_at_50%_70%,_rgb(124_158_255_/_0.16)_0%,_rgb(124_158_255_/_0.08)_28%,_transparent_72%),radial-gradient(ellipse_at_50%_24%,_rgb(124_158_255_/_0.03)_0%,_transparent_56%)]',
  )
  const heroBloomClassName = cn(
    'bg-[radial-gradient(ellipse_at_50%_78%,_rgb(124_158_255_/_0.11)_0%,_transparent_62%)]',
    visualState === 'started' &&
      'bg-[radial-gradient(ellipse_at_50%_78%,_rgb(103_214_165_/_0.11)_0%,_transparent_62%)]',
    visualState === 'paused' &&
      'bg-[radial-gradient(ellipse_at_50%_78%,_rgb(196_166_104_/_0.06)_0%,_transparent_64%)]',
    visualState === 'completed' &&
      'bg-[radial-gradient(ellipse_at_50%_78%,_rgb(124_158_255_/_0.09)_0%,_transparent_62%)]',
  )
  const timerValueClassName = cn(
    'whitespace-nowrap font-mono tabular-nums text-[clamp(2rem,8vw,2.7rem)] font-semibold leading-none tracking-[-0.065em]',
    hasPausedSession ? 'text-[rgb(233_235_229_/_0.94)]' : 'text-nuba-text',
  )
  const timerCaptionClassName = cn(
    'mt-1 inline-flex items-center gap-1 text-[10px] font-medium tracking-[0.08em]',
    hasPausedSession ? 'text-[rgb(205_181_128_/_0.78)]' : 'text-nuba-text-muted/72',
  )
  const contextHeadlineClassName = cn(
    'text-[0.74rem] font-semibold uppercase tracking-[0.16em]',
    hasPausedSession ? 'text-[rgb(215_188_130_/_0.9)]' : 'text-nuba-text/54',
  )
  const contextDetailClassName = cn(
    'text-[0.78rem] leading-5',
    hasPausedSession ? 'text-nuba-text-muted/64' : 'text-nuba-text-muted/74',
  )
  const statusGlyph = hasPausedSession ? (
    <Pause className="h-[0.72rem] w-[0.72rem] opacity-85" />
  ) : hasRunningSession ? (
    <motion.span
      className="h-1.5 w-1.5 rounded-full bg-current"
      animate={{ opacity: [0.7, 1, 0.7], scale: [0.92, 1.08, 0.92] }}
      transition={{ duration: 2.8, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }}
    />
  ) : (
    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
  )
  const timerCaption = hasPausedSession ? 'Tiempo pausado' : 'Hoy trabajado'
  const stopConfirmBadgeLabel = hasPausedSession ? 'En pausa' : 'Activa'
  const stopConfirmDescription = hasPausedSession
    ? 'Se guardará la salida con el estado actual.'
    : 'Se guardará la hora actual como salida.'
  const openCalendarDate = (date: string) => {
    const calendarDateValue = new Date(`${date}T12:00:00Z`)

    navigate(
      `/calendar?year=${calendarDateValue.getUTCFullYear()}&month=${
        calendarDateValue.getUTCMonth() + 1
      }&date=${date}`,
    )
  }
  const autoClosedDateLabel = homeAutoCloseNotice
    ? formatDateShort(`${homeAutoCloseNotice.workDate}T12:00:00Z`)
    : null
  const autoClosedEndTimeLabel = homeAutoCloseNotice
    ? formatTime(homeAutoCloseNotice.endTime)
    : null
  const isTodayAutoCloseNotice = homeAutoCloseNotice?.workDate === today.summary.date

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto overscroll-contain">
      <div className="pointer-events-none absolute inset-x-[-18%] top-5 h-32 bg-[radial-gradient(circle,_rgb(124_158_255_/_0.05),_transparent_62%)] blur-[64px]" />
      <div className="pointer-events-none absolute left-1/2 top-[30%] h-[15rem] w-[14rem] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_50%_72%,_rgb(124_158_255_/_0.05),_transparent_68%)] blur-[82px]" />
      <div className="pointer-events-none absolute left-1/2 top-[37%] h-[8rem] w-[10rem] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_50%_75%,_rgb(103_214_165_/_0.03),_transparent_68%)] blur-[58px]" />

      <section className="relative flex min-h-full flex-1 flex-col gap-2.5 px-0.5 pb-1 pt-1 sm:gap-3">
        {homeAutoCloseNotice && autoClosedDateLabel && autoClosedEndTimeLabel ? (
          <InlineAlert
            tone="warning"
            title={isTodayAutoCloseNotice ? 'Jornada cerrada automáticamente' : 'Te olvidaste de desfichar'}
          >
            <p>
              {isTodayAutoCloseNotice
                ? `La jornada se cerró automáticamente a las ${autoClosedEndTimeLabel} al superar el objetivo y el margen configurado. Revisa el ${autoClosedDateLabel} en Calendario y corrige la salida real si fue otra.`
                : `Se hizo un desfichaje automático a las ${autoClosedEndTimeLabel} para poder abrir hoy. Revisa el ${autoClosedDateLabel} en Calendario y añade la hora de salida real si fue otra.`}
            </p>
            <button
              type="button"
              onClick={() => openCalendarDate(homeAutoCloseNotice.workDate)}
              className="mt-2 inline-flex rounded-full border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-nuba-text transition hover:border-nuba-brand/28 hover:bg-nuba-brand/[0.08]"
            >
              Revisar ese día
            </button>
          </InlineAlert>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={compactStatusClassName}>
              {statusGlyph}
              {statusChipLabel}
            </span>

            {specialDayLabel ? (
              <span className="inline-flex items-center rounded-full border border-white/7 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-nuba-text-muted/88">
                {specialDayLabel}
              </span>
            ) : null}
          </div>

          {todayQuery.isRefetching ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/7 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-nuba-text-muted/88">
              <LoaderCircle className="h-3 w-3 animate-spin" />
              Sync
            </span>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col justify-between gap-3.5 sm:gap-4">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3.5 text-center sm:gap-4">
            <div className="relative flex w-full items-center justify-center">
              <motion.div
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute left-1/2 top-1/2 h-[13rem] w-[12rem] -translate-x-1/2 -translate-y-[38%] rounded-full blur-[64px] sm:h-[14rem] sm:w-[13rem] sm:blur-[72px]',
                  heroFieldClassName,
                )}
                animate={
                  hasRunningSession
                    ? { opacity: [0.44, 0.7, 0.44], scale: [0.985, 1.025, 0.985] }
                    : hasPausedSession
                      ? { opacity: 0.34, scale: 1 }
                      : { opacity: [0.34, 0.52, 0.34], scale: [0.99, 1.014, 0.99] }
                }
                transition={
                  hasRunningSession
                    ? { duration: 6, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }
                    : hasPausedSession
                      ? { duration: 0.28, ease: 'easeOut' }
                      : { duration: 5.8, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }
                }
              />
              <motion.div
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute left-1/2 top-1/2 h-[8rem] w-[7rem] -translate-x-1/2 -translate-y-[18%] blur-[42px] sm:h-[9rem] sm:w-[8rem] sm:blur-[48px]',
                  heroBloomClassName,
                )}
                animate={
                  hasRunningSession
                    ? { opacity: [0.2, 0.32, 0.2], scale: [0.99, 1.012, 0.99] }
                    : hasPausedSession
                      ? { opacity: 0.18, scale: 1 }
                      : { opacity: [0.16, 0.24, 0.16], scale: [0.995, 1.008, 0.995] }
                }
                transition={
                  hasRunningSession
                    ? { duration: 5.2, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }
                    : hasPausedSession
                      ? { duration: 0.24, ease: 'easeOut' }
                      : { duration: 5.8, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }
                }
              />

              <ElectricBorder
                borderRadius={999}
                chaos={visualState === 'started' ? 0.031 : visualState === 'paused' ? 0.008 : 0.02}
                className="relative inline-block rounded-full"
                color={electricColor}
                speed={visualState === 'started' ? 0.4 : visualState === 'paused' ? 0.08 : 0.24}
                thickness={1.12}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 6 }}
                  animate={
                    hasRunningSession
                      ? { opacity: [1, 0.99, 1], scale: [1, 1.012, 1], y: [0, -1.25, 0] }
                      : { opacity: 1, scale: 1, y: 0 }
                  }
                  transition={
                    hasRunningSession
                      ? { duration: 4.4, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }
                      : { duration: 0.42, ease: 'easeOut' }
                  }
                  className={cn(
                    'relative flex h-[min(63vw,31svh,15.75rem)] w-[min(63vw,31svh,15.75rem)] max-h-[15.75rem] max-w-[15.75rem] items-center justify-center overflow-hidden rounded-full px-7 py-7 text-center sm:h-[min(56vw,32svh,16.25rem)] sm:w-[min(56vw,32svh,16.25rem)] sm:max-h-[16.25rem] sm:max-w-[16.25rem] sm:px-[2rem] sm:py-[2rem]',
                    circleSurfaceClassName,
                    circleClassName,
                  )}
                >
                  <motion.div
                    aria-hidden="true"
                    className={cn('pointer-events-none absolute inset-[11%] rounded-full blur-3xl', circlePulseClassName)}
                    animate={
                      hasRunningSession
                        ? { opacity: [0.28, 0.48, 0.28], scale: [0.93, 1.025, 0.93] }
                        : hasPausedSession
                          ? { opacity: 0.18, scale: 0.965 }
                          : { opacity: [0.16, 0.24, 0.16], scale: [0.96, 1, 0.96] }
                    }
                    transition={
                      hasRunningSession
                        ? {
                            duration: 3.8,
                            ease: 'easeInOut',
                            repeat: Number.POSITIVE_INFINITY,
                          }
                        : hasPausedSession
                          ? { duration: 0.24, ease: 'easeOut' }
                          : {
                              duration: 5.8,
                              ease: 'easeInOut',
                              repeat: Number.POSITIVE_INFINITY,
                            }
                    }
                  />
                  {hasRunningSession ? (
                    <motion.div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-[10.5%] rounded-full border border-white/[0.08]"
                      animate={{ opacity: [0.24, 0, 0.24], scale: [0.962, 1.032, 0.962] }}
                      transition={{ duration: 2.8, ease: 'easeOut', repeat: Number.POSITIVE_INFINITY }}
                    />
                  ) : null}
                  <div className="absolute inset-[14px] rounded-full border border-white/[0.07]" />

                  <div className="relative z-10 flex w-full max-w-[10rem] flex-col items-center justify-center">
                    <div className="min-h-[2.8rem]">
                      {workedTimer.isAnimating ? (
                        <CountUp
                          from={workedTimer.previousTime}
                          to={workedTimer.currentTime}
                          duration={workedTimer.animationDurationSeconds}
                          formatter={(value) => formatClockFromSeconds(Math.round(value))}
                          className={timerValueClassName}
                        />
                      ) : (
                        <motion.p
                          initial={{ opacity: 0.92, scale: 0.992 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className={timerValueClassName}
                        >
                          {workedTodayClock}
                        </motion.p>
                      )}
                    </div>

                    <p className={timerCaptionClassName}>
                      {hasPausedSession ? <Pause className="h-[0.72rem] w-[0.72rem]" /> : null}
                      {timerCaption}
                    </p>

                    <div className="mt-3 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-medium text-nuba-text-muted/64">
                      <span className="inline-flex items-center gap-1">
                        <Coffee className="h-[0.72rem] w-[0.72rem]" />
                        {mealInlineLabel}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ArrowUpRight className="h-[0.72rem] w-[0.72rem]" />
                        {outingsInlineLabel}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </ElectricBorder>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.34, ease: 'easeOut', delay: 0.05 }}
              className="w-full max-w-[21rem] space-y-2 px-2.5"
            >
              <div className="space-y-1">
                <p className={contextHeadlineClassName}>
                  <span className="inline-flex items-center gap-1.5">
                    {hasPausedSession ? <Pause className="h-3 w-3" /> : null}
                    {contextHeadline}
                  </span>
                </p>
                <p className={contextDetailClassName}>
                  {contextDetail}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <MetricChip
                  icon={entryChipLabel ? Play : CalendarDays}
                  label={entryChipLabel ?? dayPlanLabel}
                  tone="brand"
                />
                <MetricChip icon={Coffee} label={mealChipLabel} tone="break" />
                <MetricChip icon={ArrowUpRight} label={outingsChipLabel} />
              </div>
            </motion.div>
          </div>

          <motion.section
            initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.34, ease: 'easeOut', delay: 0.1 }}
            className="mx-auto w-full max-w-[21rem] overflow-hidden rounded-[24px] border border-white/[0.03] bg-[linear-gradient(180deg,_rgb(255_255_255_/_0.016),_rgb(255_255_255_/_0.006))] shadow-[0_10px_22px_-28px_rgb(0_0_0_/_0.82)] backdrop-blur-[14px]"
          >
            <div className="px-[0.95rem] pb-[0.95rem] pt-[0.82rem]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-left text-[8.5px] font-semibold uppercase tracking-[0.22em] text-nuba-text-muted/30">
                  Acción principal
                </p>

                {actions.hasPendingAction ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/7 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-nuba-text-muted/82">
                    <LoaderCircle className="h-3 w-3 animate-spin" />
                    Actualizando
                  </span>
                ) : null}
              </div>

              <motion.div
                className="relative mt-2 rounded-[20px]"
                whileHover={{ scale: 1.002, y: -0.5 }}
                whileTap={{ scale: 0.985 }}
                transition={{ type: 'spring', stiffness: 360, damping: 26 }}
              >
                <motion.span
                  aria-hidden="true"
                  className={cn('pointer-events-none absolute inset-0 rounded-[inherit]', primaryActionHaloClassName)}
                  animate={{ opacity: [0.36, 0.7, 0.36], scale: [0.996, 1.006, 0.996] }}
                  transition={{ duration: 3, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }}
                />

                <PrimaryButton
                  fullWidth
                  loading={primaryAction.loading}
                  disabled={actions.hasPendingAction && !primaryAction.loading}
                  onClick={primaryAction.onClick}
                  className={cn(primaryActionClassName, 'group relative isolate overflow-hidden')}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-[-1px] rounded-[inherit] bg-[linear-gradient(180deg,_rgb(255_255_255_/_0.18),_rgb(255_255_255_/_0.06)_40%,_rgb(255_255_255_/_0.1)_100%)] opacity-90"
                  />
                  <motion.span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-[1px] rounded-[inherit] bg-[radial-gradient(circle_at_center,_rgb(255_255_255_/_0.22),_transparent_72%)]"
                    animate={{ opacity: [0.2, 0.32, 0.2], scale: [0.98, 1.018, 0.98] }}
                    transition={{ duration: 2.8, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }}
                  />
                  <motion.span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-[-18%] left-[-20%] w-[38%] rounded-full bg-[linear-gradient(90deg,_transparent,_rgb(255_255_255_/_0.28),_transparent)] blur-[2px]"
                    animate={{ x: ['0%', '320%'] }}
                    transition={{ duration: 3.1, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }}
                  />
                  <span className="relative z-10 inline-flex items-center gap-2">
                    <primaryAction.icon className="h-4 w-4" />
                    {primaryAction.label}
                  </span>
                </PrimaryButton>
              </motion.div>

              {secondaryActions.length > 0 ? (
                <div
                  className={cn(
                    'mt-2.5 grid gap-2',
                    secondaryActions.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
                  )}
                >
                  {secondaryActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      disabled={actions.hasPendingAction}
                      onClick={action.onClick}
                      className={cn(
                        'inline-flex min-h-[2.45rem] items-center justify-center gap-1.5 rounded-[16px] border px-3 py-2 text-[0.76rem] font-semibold tracking-[0.01em] transition duration-200 focus-visible:outline-none active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40',
                        action.tone === 'danger'
                          ? 'border-nuba-check-out/18 bg-nuba-check-out/[0.06] text-nuba-check-out/86 hover:border-nuba-check-out/32 hover:bg-nuba-check-out/[0.1]'
                          : 'border-white/[0.06] bg-white/[0.035] text-nuba-text-muted/84 hover:border-nuba-brand/24 hover:bg-nuba-brand/[0.08] hover:text-nuba-text',
                      )}
                    >
                      {action.loading ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <action.icon className="h-3.5 w-3.5" />
                      )}
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </motion.section>
        </div>
      </section>

      {actions.startMutation.isError ||
      actions.pauseMutation.isError ||
      actions.registerOutingMutation.isError ||
      actions.resumeMutation.isError ||
      actions.stopMutation.isError ? (
        <InlineAlert tone="error" title="No pudimos completar la acción">
          {(actions.startMutation.error ||
            actions.pauseMutation.error ||
            actions.registerOutingMutation.error ||
            actions.resumeMutation.error ||
            actions.stopMutation.error) instanceof Error
            ? (
                actions.startMutation.error ||
                actions.pauseMutation.error ||
                actions.registerOutingMutation.error ||
                actions.resumeMutation.error ||
                actions.stopMutation.error
              )?.message
            : 'Revisa el estado actual de la sesión y vuelve a intentarlo.'}
        </InlineAlert>
      ) : null}

      {hasCarryOverSession && carryOverSession ? (
        <InlineAlert tone="warning" title="Hay una jornada anterior todavía abierta">
          {`La sesión del ${formatDateShort(
            carryOverSession.startTime,
          )} sigue pendiente. Corrígela desde Calendario antes de fichar hoy.`}
        </InlineAlert>
      ) : null}

      <AnimatePresence>
        {showStopConfirm ? (
          <>
            <motion.button
              type="button"
              aria-label="Cerrar confirmación de fin de jornada"
              onClick={() => setIsStopConfirmOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="fixed inset-0 z-[60] bg-[rgb(8_11_16_/_0.52)] backdrop-blur-[6px]"
            />

            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="stop-confirm-title"
              aria-describedby="stop-confirm-description"
              initial={{ y: '100%', opacity: 0.96 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0.96 }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              className="fixed inset-x-0 bottom-0 z-[70] mx-auto w-full max-w-3xl rounded-t-[32px] border border-white/[0.08] bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.98),_rgb(18_24_33_/_0.98))] shadow-[0_-30px_78px_-36px_rgba(0,0,0,0.92)] backdrop-blur-[20px] lg:bottom-4 lg:left-1/2 lg:w-[min(28rem,calc(100vw-2rem))] lg:-translate-x-1/2 lg:rounded-[32px]"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
            >
              <div className="flex justify-center px-4 pt-2.5">
                <span className="h-1.5 w-12 rounded-full bg-white/10" aria-hidden="true" />
              </div>

              <div className="px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-nuba-check-out/22 bg-nuba-check-out/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-nuba-check-out">
                        Confirmación
                      </span>
                      <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-nuba-text-muted/78">
                        {stopConfirmBadgeLabel}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h3
                        id="stop-confirm-title"
                        className="text-[1.02rem] font-semibold tracking-[-0.04em] text-nuba-text sm:text-[1.12rem]"
                      >
                        ¿Terminar jornada?
                      </h3>
                      <p
                        id="stop-confirm-description"
                        className="max-w-sm text-sm leading-5 text-nuba-text-muted/74"
                      >
                        {stopConfirmDescription}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsStopConfirmOpen(false)}
                    aria-label="Cerrar confirmación"
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] text-nuba-text-muted/78 transition hover:border-white/12 hover:bg-white/[0.06] hover:text-nuba-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nuba-brand"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setIsStopConfirmOpen(false)}
                    disabled={actions.stopMutation.isPending}
                    className="inline-flex min-h-[2.9rem] items-center justify-center rounded-[18px] border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm font-semibold text-nuba-text-muted/88 transition duration-200 hover:border-white/14 hover:bg-white/[0.06] hover:text-nuba-text disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Seguir fichando
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      actions.stopMutation.mutate()
                    }}
                    disabled={actions.stopMutation.isPending}
                    className="inline-flex min-h-[2.9rem] items-center justify-center gap-2 rounded-[18px] border border-nuba-check-out/34 bg-[linear-gradient(135deg,_rgb(255_122_122_/_0.2),_rgb(157_52_80_/_0.22))] px-4 py-3 text-sm font-semibold text-nuba-text shadow-[inset_0_1px_0_rgb(255_255_255_/_0.08),0_18px_32px_-24px_rgb(255_122_122_/_0.5)] transition duration-200 hover:border-nuba-check-out/50 hover:bg-[linear-gradient(135deg,_rgb(255_122_122_/_0.26),_rgb(157_52_80_/_0.3))] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actions.stopMutation.isPending ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    Terminar jornada
                  </button>
                </div>
              </div>
            </motion.section>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
