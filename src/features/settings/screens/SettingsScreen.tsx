import { useEffect, useState, type ReactNode } from 'react'
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import {
  Bell,
  CalendarDays,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  LogOut,
  UserRound,
} from 'lucide-react'
import { useAuthSession } from '../../auth/AuthSessionProvider'
import { exportsApi } from '../../exports/api/exports.api'
import { notificationsApi } from '../../notifications/api/notifications.api'
import { notificationsKeys } from '../../notifications/api/notifications.keys'
import { settingsApi } from '../api/settings.api'
import { settingsKeys } from '../api/settings.keys'
import { queryClient } from '../../../shared/api/query-client'
import { DangerButton, PrimaryButton } from '../../../shared/ui/buttons/Button'
import { InlineAlert } from '../../../shared/ui/feedback/InlineAlert'
import { ErrorState, LoadingState } from '../../../shared/ui/states/StateViews'
import { type DayOfWeek } from '../../../shared/types/common'
import { getDayOfWeekLabel } from '../../../shared/utils/format'
import { cn } from '../../../shared/utils/cn'
import { isApiError } from '../../../shared/api/api-error'
import { downloadBlob } from '../../../shared/utils/download'

const FIXED_TIME_ZONE = 'Europe/Madrid'
const NOTIFICATIONS_SETTINGS_ENABLED = false
const TARGET_REMINDER_STORAGE_KEY = 'nuba.settings.targetReminderEnabled'
const EXPORT_RANGE_STORAGE_KEY = 'nuba.settings.defaultExportRange'

const notificationsFormSchema = z.object({
  smartRemindersEnabled: z.boolean(),
  remindStart: z.boolean(),
  remindPause: z.boolean(),
  remindStop: z.boolean(),
})

type NotificationsFormValues = z.infer<typeof notificationsFormSchema>
type ScheduleMode = 'same' | 'custom'
type ExportRange = 'week' | 'month' | 'quarter'
type ExportFormat = 'csv' | 'pdf'
type ExportFilters = {
  from: string
  to: string
}
type ExportActionTone = 'csv' | 'pdf'

const workDays: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']
const weekDays: DayOfWeek[] = [...workDays, 'SATURDAY', 'SUNDAY']

const defaultGoalMinutesByDay = weekDays.reduce<Record<DayOfWeek, number>>(
  (accumulator, dayOfWeek) => ({
    ...accumulator,
    [dayOfWeek]: workDays.includes(dayOfWeek) ? 480 : 0,
  }),
  {} as Record<DayOfWeek, number>,
)

const exportRangeOptions: Array<{
  value: ExportRange
  label: string
  description: string
}> = [
  { value: 'week', label: 'Semana', description: 'Actual' },
  { value: 'month', label: 'Mes', description: 'Actual' },
  { value: 'quarter', label: '3 meses', description: 'Recientes' },
]

const exportActionClasses: Record<
  ExportActionTone,
  {
    button: string
    glow: string
    icon: string
    extension: string
  }
> = {
  csv: {
    button:
      'border-nuba-check-in/22 bg-[linear-gradient(145deg,_rgb(91_231_169_/_0.11),_rgb(26_35_48_/_0.5)_18%,_rgb(18_24_33_/_0.84)_54%,_rgb(11_15_20_/_0.96))] hover:border-nuba-check-in/36 hover:shadow-[0_20px_48px_-34px_rgb(91_231_169_/_0.8)]',
    glow: 'bg-nuba-check-in/16',
    icon: 'border-nuba-check-in/24 bg-nuba-check-in/10 text-nuba-check-in',
    extension: 'border-nuba-check-in/18 bg-nuba-check-in/8 text-nuba-check-in',
  },
  pdf: {
    button:
      'border-nuba-check-out/22 bg-[linear-gradient(145deg,_rgb(255_122_122_/_0.11),_rgb(26_35_48_/_0.5)_18%,_rgb(18_24_33_/_0.84)_54%,_rgb(11_15_20_/_0.96))] hover:border-nuba-check-out/36 hover:shadow-[0_20px_48px_-34px_rgb(255_122_122_/_0.8)]',
    glow: 'bg-nuba-check-out/14',
    icon: 'border-nuba-check-out/24 bg-nuba-check-out/10 text-nuba-check-out',
    extension: 'border-nuba-check-out/18 bg-nuba-check-out/8 text-nuba-check-out',
  },
}

const formatGoalMinutes = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.round(minutes || 0))
  if (safeMinutes === 0) return '0h'
  const hours = Math.floor(safeMinutes / 60)
  const remainder = safeMinutes % 60
  return `${hours}h ${remainder.toString().padStart(2, '0')}m`
}

const getStoredBoolean = (key: string, fallback: boolean) => {
  if (typeof window === 'undefined') return fallback
  const value = window.localStorage.getItem(key)
  return value === null ? fallback : value === 'true'
}

const getStoredExportRange = (): ExportRange => {
  if (typeof window === 'undefined') return 'month'
  const value = window.localStorage.getItem(EXPORT_RANGE_STORAGE_KEY)
  return value === 'week' || value === 'quarter' ? value : 'month'
}

const getExportRangeFilters = (range: ExportRange): ExportFilters => {
  const now = new Date()
  let fromDate: Date
  let toDate: Date

  if (range === 'week') {
    fromDate = startOfWeek(now, { weekStartsOn: 1 })
    toDate = endOfWeek(now, { weekStartsOn: 1 })
  } else if (range === 'quarter') {
    fromDate = startOfMonth(subMonths(now, 2))
    toDate = endOfMonth(now)
  } else {
    fromDate = startOfMonth(now)
    toDate = endOfMonth(now)
  }

  return {
    from: format(fromDate, 'yyyy-MM-dd'),
    to: format(toDate, 'yyyy-MM-dd'),
  }
}

const getExportFileName = (filters: ExportFilters, formatType: ExportFormat) =>
  `nuba-${filters.from}-${filters.to}.${formatType}`

const getExportRangeLabel = (range: ExportRange) => {
  switch (range) {
    case 'week':
      return 'Semana actual'
    case 'month':
      return 'Mes actual'
    case 'quarter':
      return 'Últimos 3 meses'
  }
}

const formatExportRangeDate = (value: string) => {
  const [, month, day] = value.split('-')
  return `${day}/${month}`
}

function SettingsSection({
  action,
  children,
  icon,
  kicker,
  prominence = 'normal',
  title,
}: {
  action?: ReactNode
  children: ReactNode
  icon: ReactNode
  kicker?: string
  prominence?: 'normal' | 'hero'
  title: string
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[30px] border border-[#2A3545]/72 p-4 shadow-[0_26px_72px_-46px_rgb(0_0_0_/_0.95)] sm:p-5',
        'bg-[radial-gradient(circle_at_top_right,_rgb(124_158_255_/_0.06),_transparent_34%),linear-gradient(180deg,_rgb(18_24_33_/_0.94),_rgb(15_21_30_/_0.97)_58%,_rgb(11_15_20_/_0.985))]',
        prominence === 'hero' &&
          'border-nuba-brand/18 bg-[radial-gradient(circle_at_top_right,_rgb(124_158_255_/_0.08),_transparent_34%),linear-gradient(180deg,_rgb(24_33_46_/_0.9),_rgb(18_24_33_/_0.95)_56%,_rgb(11_15_20_/_0.985))]',
      )}
    >
      <div className="relative z-10">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-[#1A2330]/72 text-nuba-brand">
              {icon}
            </span>
            <div className="space-y-0.5">
              {kicker ? (
                <p className="text-[0.64rem] font-semibold uppercase tracking-[0.22em] text-nuba-text-muted/52">
                  {kicker}
                </p>
              ) : null}
              <h2 className="text-[1.06rem] font-semibold tracking-[-0.035em] text-nuba-text">
                {title}
              </h2>
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>

        {children}
      </div>
    </section>
  )
}

function PreferenceRow({
  children,
  description,
  label,
}: {
  children: ReactNode
  description?: string
  label: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[22px] border border-white/[0.07] bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.24),_rgb(18_24_33_/_0.44))] px-3.5 py-3">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-nuba-text">{label}</p>
        {description ? <p className="text-xs leading-5 text-nuba-text-muted/74">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SettingsToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="relative inline-flex items-center">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span className="h-7 w-12 rounded-full border border-white/10 bg-nuba-bg transition peer-checked:border-nuba-brand/32 peer-checked:bg-nuba-brand/20" />
      <span className="pointer-events-none absolute left-1 h-5 w-5 rounded-full bg-nuba-text-muted shadow transition peer-checked:translate-x-5 peer-checked:bg-nuba-brand" />
    </label>
  )
}

function ScheduleModeButton({
  active,
  description,
  label,
  onClick,
}: {
  active: boolean
  description: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-[22px] border px-3.5 py-3 text-left transition',
        active
          ? 'border-nuba-brand/38 bg-nuba-brand/12 text-nuba-text shadow-[0_0_24px_-18px_rgb(124_158_255_/_0.9)]'
          : 'border-white/[0.07] bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.22),_rgb(18_24_33_/_0.4))] text-nuba-text-muted hover:border-white/12 hover:bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.3),_rgb(18_24_33_/_0.48))]',
      )}
    >
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs leading-5 opacity-76">{description}</p>
    </button>
  )
}

function MinutesInput({
  ariaLabel,
  onChange,
  value,
}: {
  ariaLabel: string
  onChange: (value: number) => void
  value: number
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        step={15}
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
        className="w-24 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.8),_rgb(18_24_33_/_0.92))] px-3 py-2 text-right text-sm font-semibold text-nuba-text outline-none transition focus:border-nuba-brand/50"
      />
      <span className="text-xs font-medium text-nuba-text-muted/64">min</span>
    </div>
  )
}

function ExportActionButton({
  description,
  disabled = false,
  extension,
  icon,
  label,
  loading,
  onClick,
  tone,
}: {
  description?: string
  disabled?: boolean
  extension: string
  icon: ReactNode
  label: string
  loading?: boolean
  onClick: () => void
  tone: ExportActionTone
}) {
  const styles = exportActionClasses[tone]

  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-[24px] border p-3.5 text-left text-nuba-text transition duration-300 disabled:cursor-wait disabled:opacity-70',
        styles.button,
      )}
    >
      <span
        className={cn(
          'pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full blur-2xl transition duration-300 group-hover:scale-125',
          styles.glow,
        )}
      />
      <span className="pointer-events-none absolute inset-x-3 top-0 h-px bg-white/14" />

      <span className="relative flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgb(255_255_255_/_0.08)]',
              styles.icon,
            )}
          >
            {icon}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold tracking-[-0.02em]">
              {loading ? 'Preparando...' : label}
            </span>
            {description ? (
              <span className="mt-1 block text-xs leading-5 text-nuba-text-muted/72">
                {description}
              </span>
            ) : null}
          </span>
        </span>

        <span
          className={cn(
            'shrink-0 rounded-full border px-2 py-1 text-[0.62rem] font-bold uppercase tracking-[0.16em]',
            styles.extension,
          )}
        >
          {extension}
        </span>
      </span>
    </button>
  )
}

function ExportRangeButton({
  active,
  description,
  label,
  onChange,
}: {
  active: boolean
  description: string
  label: string
  onChange: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onChange}
      className={cn(
        'rounded-[18px] border px-3 py-2.5 text-left transition duration-300',
        active
          ? 'border-nuba-brand/36 bg-nuba-brand/13 text-nuba-text shadow-[0_14px_36px_-30px_rgb(124_158_255_/_0.9)]'
          : 'border-white/[0.07] bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.24),_rgb(18_24_33_/_0.44))] text-nuba-text-muted hover:border-white/12 hover:bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.3),_rgb(18_24_33_/_0.5))]',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold tracking-[-0.02em]">{label}</span>
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full transition',
            active ? 'bg-nuba-brand shadow-[0_0_16px_rgb(124_158_255_/_0.8)]' : 'bg-white/14',
          )}
        />
      </span>
      <span className="mt-0.5 block text-[0.68rem] font-medium text-nuba-text-muted/66">
        {description}
      </span>
    </button>
  )
}

function ExportRangePanel({
  filters,
  onChange,
  value,
}: {
  filters: ExportFilters
  onChange: (value: ExportRange) => void
  value: ExportRange
}) {
  return (
    <div className="relative overflow-hidden rounded-[26px] border border-[#2A3545]/72 bg-[linear-gradient(145deg,_rgb(26_35_48_/_0.56),_rgb(18_24_33_/_0.82)_46%,_rgb(11_15_20_/_0.96))] p-3.5 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.06)]">
      <div className="pointer-events-none absolute -right-12 -top-14 h-32 w-32 rounded-full bg-nuba-brand/11 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(0deg,_rgb(91_231_169_/_0.035),_transparent)]" />

      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-nuba-brand/20 bg-nuba-brand/10 text-nuba-brand">
              <CalendarDays className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[0.64rem] font-semibold uppercase tracking-[0.22em] text-nuba-text-muted/54">
                Rango activo
              </p>
              <p className="mt-1 text-base font-semibold tracking-[-0.035em] text-nuba-text">
                {getExportRangeLabel(value)}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-white/[0.08] bg-[#121821]/70 px-2.5 py-1.5 text-[0.68rem] font-semibold tabular-nums text-nuba-text-muted/82">
            {formatExportRangeDate(filters.from)} - {formatExportRangeDate(filters.to)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {exportRangeOptions.map((option) => (
            <ExportRangeButton
              key={option.value}
              active={value === option.value}
              label={option.label}
              description={option.description}
              onChange={() => onChange(option.value)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function SettingsScreen() {
  const auth = useAuthSession()
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('same')
  const [dailyTargetMinutes, setDailyTargetMinutes] = useState(480)
  const [goalMinutesByDay, setGoalMinutesByDay] = useState<Record<DayOfWeek, number>>(defaultGoalMinutesByDay)
  const [autoCompleteForgottenCheckout, setAutoCompleteForgottenCheckout] = useState(false)
  const [autoCompleteGraceMinutes, setAutoCompleteGraceMinutes] = useState(30)
  const [targetReminderEnabled, setTargetReminderEnabled] = useState(() =>
    getStoredBoolean(TARGET_REMINDER_STORAGE_KEY, true),
  )
  const [exportRange, setExportRange] = useState<ExportRange>(getStoredExportRange)

  const meQuery = useQuery({
    queryKey: settingsKeys.me(),
    queryFn: settingsApi.getCurrentUser,
    enabled: auth.isAuthenticated,
  })
  const preferencesQuery = useQuery({
    queryKey: settingsKeys.preferences(),
    queryFn: settingsApi.getSettings,
    enabled: auth.isAuthenticated,
  })
  const goalsQuery = useQuery({
    queryKey: settingsKeys.goals(),
    queryFn: settingsApi.getDailyGoals,
    enabled: auth.isAuthenticated,
  })
  const notificationsQuery = useQuery({
    queryKey: notificationsKeys.settings(),
    queryFn: notificationsApi.getSettings,
    enabled: auth.isAuthenticated && NOTIFICATIONS_SETTINGS_ENABLED,
  })

  const notificationsForm = useForm<NotificationsFormValues>({
    resolver: zodResolver(notificationsFormSchema),
    defaultValues: {
      smartRemindersEnabled: true,
      remindStart: true,
      remindPause: true,
      remindStop: true,
    },
  })

  useEffect(() => {
    if (!preferencesQuery.data) return

    const frameId = window.requestAnimationFrame(() => {
      setScheduleMode(preferencesQuery.data.sameHoursEachDay ? 'same' : 'custom')
      setAutoCompleteForgottenCheckout(
        preferencesQuery.data.autoCompleteForgottenCheckout,
      )
      setAutoCompleteGraceMinutes(preferencesQuery.data.autoCompleteGraceMinutes)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [preferencesQuery.data])

  useEffect(() => {
    if (!goalsQuery.data) return

    const nextGoals = { ...defaultGoalMinutesByDay }
    goalsQuery.data.goals.forEach((goal) => {
      nextGoals[goal.dayOfWeek] = goal.targetMinutes
    })

    const frameId = window.requestAnimationFrame(() => {
      setGoalMinutesByDay(nextGoals)
      setDailyTargetMinutes(nextGoals.MONDAY || 480)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [goalsQuery.data])

  useEffect(() => {
    if (notificationsQuery.data) {
      notificationsForm.reset(notificationsQuery.data)
    }
  }, [notificationsForm, notificationsQuery.data])

  useEffect(() => {
    if (NOTIFICATIONS_SETTINGS_ENABLED && typeof window !== 'undefined') {
      window.localStorage.setItem(TARGET_REMINDER_STORAGE_KEY, String(targetReminderEnabled))
    }
  }, [targetReminderEnabled])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(EXPORT_RANGE_STORAGE_KEY, exportRange)
    }
  }, [exportRange])

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const goals = weekDays.map((dayOfWeek) => ({
        dayOfWeek,
        targetMinutes:
          scheduleMode === 'same'
            ? workDays.includes(dayOfWeek)
              ? dailyTargetMinutes
              : 0
            : workDays.includes(dayOfWeek)
              ? goalMinutesByDay[dayOfWeek] ?? 0
              : 0,
      }))

      await settingsApi.updateSettings({
        sameHoursEachDay: scheduleMode === 'same',
        timeZone: FIXED_TIME_ZONE,
        autoCompleteForgottenCheckout,
        autoCompleteGraceMinutes,
      })
      await settingsApi.updateDailyGoals({ goals })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsKeys.preferences() }),
        queryClient.invalidateQueries({ queryKey: settingsKeys.goals() }),
      ])
    },
  })

  const notificationsMutation = useMutation({
    mutationFn: notificationsApi.updateSettings,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationsKeys.settings() })
    },
  })

  const csvExportMutation = useMutation({
    mutationFn: (filters: ExportFilters) => exportsApi.downloadCsv(filters),
    onSuccess: (blob, filters) => {
      downloadBlob(blob, getExportFileName(filters, 'csv'))
    },
  })

  const pdfExportMutation = useMutation({
    mutationFn: (filters: ExportFilters) => exportsApi.downloadPdf(filters),
    onSuccess: (blob, filters) => {
      downloadBlob(blob, getExportFileName(filters, 'pdf'))
    },
  })

  const smartRemindersEnabled = useWatch({
    control: notificationsForm.control,
    name: 'smartRemindersEnabled',
  })
  const remindStart = useWatch({
    control: notificationsForm.control,
    name: 'remindStart',
  })
  const remindPause = useWatch({
    control: notificationsForm.control,
    name: 'remindPause',
  })
  const remindStop = useWatch({
    control: notificationsForm.control,
    name: 'remindStop',
  })

  const isLoading =
    (meQuery.isLoading ||
      preferencesQuery.isLoading ||
      goalsQuery.isLoading ||
      (NOTIFICATIONS_SETTINGS_ENABLED && notificationsQuery.isLoading)) &&
    (!meQuery.data ||
      !preferencesQuery.data ||
      !goalsQuery.data ||
      (NOTIFICATIONS_SETTINGS_ENABLED && !notificationsQuery.data))

  const hasError =
    (meQuery.isError && !meQuery.data) ||
    (preferencesQuery.isError && !preferencesQuery.data) ||
    (goalsQuery.isError && !goalsQuery.data) ||
    (NOTIFICATIONS_SETTINGS_ENABLED && notificationsQuery.isError && !notificationsQuery.data)

  const fullName =
    meQuery.data?.fullName ||
    [meQuery.data?.firstName, meQuery.data?.lastName].filter(Boolean).join(' ') ||
    'Usuario Nuba'

  const exportIsPending = csvExportMutation.isPending || pdfExportMutation.isPending
  const exportError = csvExportMutation.error || pdfExportMutation.error
  const exportErrorMessage = isApiError(exportError)
    ? exportError.message
    : exportError instanceof Error
      ? exportError.message
      : 'Inténtalo de nuevo en unos segundos.'

  const selectedExportFilters = getExportRangeFilters(exportRange)

  const updateCustomGoal = (dayOfWeek: DayOfWeek, targetMinutes: number) => {
    setGoalMinutesByDay((current) => ({
      ...current,
      [dayOfWeek]: targetMinutes,
    }))
  }

  const exportCurrentRange = (formatType: ExportFormat) => {
    const filters = getExportRangeFilters(exportRange)

    if (formatType === 'csv') {
      pdfExportMutation.reset()
      csvExportMutation.mutate(filters)
      return
    }

    csvExportMutation.reset()
    pdfExportMutation.mutate(filters)
  }

  if (isLoading) {
    return (
      <LoadingState
        title="Cargando ajustes"
        description="Preparando tus preferencias."
      />
    )
  }

  if (hasError) {
    const error =
      meQuery.error ||
      preferencesQuery.error ||
      goalsQuery.error ||
      (NOTIFICATIONS_SETTINGS_ENABLED ? notificationsQuery.error : null)

    return (
      <ErrorState
        title="No pudimos cargar los ajustes"
        description={
          isApiError(error)
            ? error.message
            : 'Inténtalo de nuevo en unos segundos.'
        }
        onRetry={() => {
          void meQuery.refetch()
          void preferencesQuery.refetch()
          void goalsQuery.refetch()
          if (NOTIFICATIONS_SETTINGS_ENABLED) {
            void notificationsQuery.refetch()
          }
        }}
      />
    )
  }

  return (
    <div className="relative space-y-4 overflow-hidden pb-4">
      <div className="pointer-events-none absolute inset-x-[-24%] top-0 h-48 bg-[radial-gradient(circle,_rgb(124_158_255_/_0.07),_transparent_62%)] blur-[82px]" />

      <div className="relative space-y-4">
        <SettingsSection
          icon={<UserRound className="h-4 w-4" />}
          title="Perfil"
          kicker="Cuenta"
          action={
            <DangerButton
              onClick={() => void auth.signOut()}
              className="px-3 py-2 text-xs"
            >
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </DangerButton>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-white/[0.07] bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.32),_rgb(18_24_33_/_0.52))] px-4 py-3.5">
              <p className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-nuba-text-muted/54">
                Nombre
              </p>
              <p className="mt-1.5 truncate text-base font-semibold text-nuba-text">{fullName}</p>
            </div>
            <div className="rounded-[24px] border border-white/[0.07] bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.32),_rgb(18_24_33_/_0.52))] px-4 py-3.5">
              <p className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-nuba-text-muted/54">
                Email
              </p>
              <p className="mt-1.5 truncate text-base font-semibold text-nuba-text">
                {meQuery.data?.email ?? 'Sin email'}
              </p>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={<Clock3 className="h-4 w-4" />}
          title="Jornada y objetivos"
          kicker="Principal"
          prominence="hero"
        >
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <ScheduleModeButton
                active={scheduleMode === 'same'}
                label="Todos los días iguales"
                description="Un objetivo para lunes a viernes."
                onClick={() => setScheduleMode('same')}
              />
              <ScheduleModeButton
                active={scheduleMode === 'custom'}
                label="Horas diferentes según el día"
                description="Cada laborable con su objetivo."
                onClick={() => setScheduleMode('custom')}
              />
            </div>

            {scheduleMode === 'same' ? (
              <div className="rounded-[24px] border border-white/[0.07] bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.3),_rgb(18_24_33_/_0.5))] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-nuba-text">Horas diarias</p>
                    <p className="mt-1 text-xs text-nuba-text-muted/72">
                      Lunes a viernes · sábado y domingo 0
                    </p>
                  </div>
                  <MinutesInput
                    ariaLabel="Objetivo diario en minutos"
                    value={dailyTargetMinutes}
                    onChange={setDailyTargetMinutes}
                  />
                </div>
                <div className="mt-4 rounded-2xl border border-nuba-brand/18 bg-[linear-gradient(180deg,_rgb(124_158_255_/_0.14),_rgb(124_158_255_/_0.08))] px-3 py-2 text-sm font-semibold text-nuba-brand">
                  {formatGoalMinutes(dailyTargetMinutes)} al día
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {workDays.map((dayOfWeek) => (
                  <div
                    key={dayOfWeek}
                    className="flex items-center justify-between gap-3 rounded-[20px] border border-white/[0.07] bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.22),_rgb(18_24_33_/_0.42))] px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-nuba-text">
                        {getDayOfWeekLabel(dayOfWeek)}
                      </p>
                      <p className="text-xs text-nuba-text-muted/66">
                        {formatGoalMinutes(goalMinutesByDay[dayOfWeek] ?? 0)}
                      </p>
                    </div>
                    <MinutesInput
                      ariaLabel={`Objetivo de ${getDayOfWeekLabel(dayOfWeek)}`}
                      value={goalMinutesByDay[dayOfWeek] ?? 0}
                      onChange={(value) => updateCustomGoal(dayOfWeek, value)}
                    />
                  </div>
                ))}

                <div className="rounded-[18px] border border-white/[0.05] bg-[#121821]/56 px-3 py-2 text-xs font-medium text-nuba-text-muted/58">
                  Sábado y domingo quedan como días libres.
                </div>
              </div>
            )}

            <div className="rounded-[24px] border border-white/[0.07] bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.3),_rgb(18_24_33_/_0.5))] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-nuba-text">
                    Cierre automático de olvidos
                  </p>
                  <p className="text-xs leading-5 text-nuba-text-muted/72">
                    Si una jornada de un día anterior sigue abierta y ya ha superado su objetivo
                    más un margen, Nuba la cerrará sola para no bloquear el siguiente fichaje.
                  </p>
                </div>
                <SettingsToggle
                  label="Activar cierre automático de fichajes olvidados"
                  checked={autoCompleteForgottenCheckout}
                  onChange={setAutoCompleteForgottenCheckout}
                />
              </div>

              <div className="mt-4 rounded-[20px] border border-white/[0.06] bg-black/10 px-3.5 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-nuba-text">Margen antes de cerrar</p>
                    <p className="mt-1 text-xs text-nuba-text-muted/70">
                      Ese tiempo aparecerá en el aviso automático y luego podrás corregirlo desde
                      Calendario si la salida real fue otra.
                    </p>
                  </div>
                  <MinutesInput
                    ariaLabel="Margen de autocierre en minutos"
                    value={autoCompleteGraceMinutes}
                    onChange={setAutoCompleteGraceMinutes}
                  />
                </div>
              </div>

              {autoCompleteForgottenCheckout ? (
                <div className="mt-4 rounded-2xl border border-nuba-break/18 bg-[linear-gradient(180deg,_rgb(255_209_102_/_0.12),_rgb(255_209_102_/_0.06))] px-3 py-2.5 text-sm text-nuba-text">
                  Si olvidas desfichar, verás un mensaje indicando que se completó
                  automáticamente tras {formatGoalMinutes(autoCompleteGraceMinutes)} de margen.
                </div>
              ) : null}
            </div>

            <PrimaryButton
              type="button"
              loading={scheduleMutation.isPending}
              fullWidth
              onClick={() => scheduleMutation.mutate()}
            >
              Guardar jornada
            </PrimaryButton>
          </div>
        </SettingsSection>

        {NOTIFICATIONS_SETTINGS_ENABLED ? (
          <SettingsSection
            icon={<Bell className="h-4 w-4" />}
            title="Recordatorios"
            kicker="Avisos"
          >
            <form
              className="space-y-3"
              onSubmit={notificationsForm.handleSubmit((values) => notificationsMutation.mutate(values))}
            >
              <PreferenceRow label="Entrada">
                <SettingsToggle
                  label="Recordatorio de entrada"
                  checked={remindStart}
                  onChange={(checked) =>
                    notificationsForm.setValue('remindStart', checked, { shouldDirty: true })
                  }
                />
              </PreferenceRow>
              <PreferenceRow label="Salida">
                <SettingsToggle
                  label="Recordatorio de salida"
                  checked={remindStop}
                  onChange={(checked) =>
                    notificationsForm.setValue('remindStop', checked, { shouldDirty: true })
                  }
                />
              </PreferenceRow>
              <PreferenceRow label="Pausa demasiado larga">
                <SettingsToggle
                  label="Aviso de pausa demasiado larga"
                  checked={remindPause}
                  onChange={(checked) =>
                    notificationsForm.setValue('remindPause', checked, { shouldDirty: true })
                  }
                />
              </PreferenceRow>
              <PreferenceRow label="Posible olvido de fichaje">
                <SettingsToggle
                  label="Aviso por posible olvido"
                  checked={smartRemindersEnabled}
                  onChange={(checked) =>
                    notificationsForm.setValue('smartRemindersEnabled', checked, { shouldDirty: true })
                  }
                />
              </PreferenceRow>
              <PreferenceRow label="Cerca del objetivo diario">
                <SettingsToggle
                  label="Aviso al acercarse al objetivo"
                  checked={targetReminderEnabled}
                  onChange={setTargetReminderEnabled}
                />
              </PreferenceRow>

              <PrimaryButton
                type="submit"
                loading={notificationsMutation.isPending}
                fullWidth
              >
                Guardar recordatorios
              </PrimaryButton>
            </form>
          </SettingsSection>
        ) : null}

        <SettingsSection
          icon={<Download className="h-4 w-4" />}
          title="Exportación y datos"
          kicker="Informes"
        >
          <div className="space-y-3.5">
            <ExportRangePanel
              value={exportRange}
              filters={selectedExportFilters}
              onChange={setExportRange}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <ExportActionButton
                label="Exportar CSV"
                description="Para hojas de cálculo."
                extension="CSV"
                icon={<FileSpreadsheet className="h-4 w-4" />}
                disabled={exportIsPending}
                loading={csvExportMutation.isPending}
                onClick={() => exportCurrentRange('csv')}
                tone="csv"
              />
              <ExportActionButton
                label="Exportar PDF"
                description="Para enviar o archivar."
                extension="PDF"
                icon={<FileText className="h-4 w-4" />}
                disabled={exportIsPending}
                loading={pdfExportMutation.isPending}
                onClick={() => exportCurrentRange('pdf')}
                tone="pdf"
              />
            </div>

            {exportIsPending ? (
              <div className="flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.2),_rgb(18_24_33_/_0.42))] px-3 py-2 text-xs font-medium text-nuba-text-muted/72">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-nuba-brand" />
                Preparando el archivo con el rango seleccionado.
              </div>
            ) : null}
          </div>
        </SettingsSection>

        {scheduleMutation.isSuccess ? (
          <InlineAlert tone="success" title="Jornada guardada">
            Tus objetivos y el comportamiento de autocierre ya están actualizados.
          </InlineAlert>
        ) : null}

        {NOTIFICATIONS_SETTINGS_ENABLED && notificationsMutation.isSuccess ? (
          <InlineAlert tone="success" title="Recordatorios guardados">
            Tus avisos ya están actualizados.
          </InlineAlert>
        ) : null}

        {(csvExportMutation.isSuccess || pdfExportMutation.isSuccess) ? (
          <InlineAlert tone="success" title="Exportación preparada">
            Se ha iniciado la descarga con el rango seleccionado.
          </InlineAlert>
        ) : null}

        {(csvExportMutation.isError || pdfExportMutation.isError) ? (
          <InlineAlert tone="error" title="No se pudo exportar">
            {exportErrorMessage}
          </InlineAlert>
        ) : null}
      </div>
    </div>
  )
}
