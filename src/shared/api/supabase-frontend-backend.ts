import {
  addDays,
  addMinutes,
  differenceInMinutes,
  endOfMonth,
  startOfMonth,
  subDays,
} from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { env } from '../../config/env'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/supabase-database.types'
import { ApiError } from './api-error'
import { getAuthIdentity, type AuthIdentity } from './auth-resolver'
import type { QueryParams, DayOfWeek, FieldError } from '../types/common'
import type {
  BreakType,
  DaySummary,
  ManualEdit,
  TodayWorkSessionsResponse,
  WorkBreak,
  WorkSessionAutoCloseNotice,
  WorkSession,
  WorkSessionDetailResponse,
  WorkSessionHistoryResponse,
  WorkSessionStatus,
  WorkSessionUpdatePayload,
  WorkTimelineEvent,
} from '../types/work-session'
import type {
  CurrentUser,
  DailyGoal,
  DailyGoalsResponse,
  MeSettings,
  NotificationsSettings,
} from '../types/settings'
import type {
  CalendarMonthResponse,
  DashboardDayContext,
  DashboardPeriodSummary,
  DashboardStatisticsResponse,
  DashboardWorkPattern,
} from '../types/statistics'
import type {
  PushSubscriptionPayload,
  PushSubscriptionsResponse,
} from '../types/notifications'
import { buildWorkSessionsCsv, buildWorkSessionsPdf } from '../utils/export-report'

type SupabaseFrontendRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: QueryParams
  body?: unknown
  signal?: AbortSignal
}

type AppUserRow = Database['public']['Tables']['app_users']['Row']
type BreakSessionRow = Database['public']['Tables']['break_sessions']['Row']
type CalendarSpecialDayRow = Database['public']['Tables']['calendar_special_days']['Row']
type ManualEditLogRow = Database['public']['Tables']['manual_edit_logs']['Row']
type PushSubscriptionRow = Database['public']['Tables']['push_subscriptions']['Row']
type NotificationSettingsRow = Database['public']['Tables']['notification_settings']['Row']
type UserDailyGoalRow = Database['public']['Tables']['user_daily_goals']['Row']
type UserWorkSettingsRow = Database['public']['Tables']['user_work_settings']['Row']
type WorkSessionRow = Database['public']['Tables']['work_sessions']['Row']

type SessionBundle = {
  session: WorkSessionRow
  breaks: BreakSessionRow[]
  manualEditLogs: ManualEditLogRow[]
}

const asRows = <TRow>(data: unknown): TRow[] => (Array.isArray(data) ? (data as TRow[]) : [])

const asMaybeRow = <TRow>(data: unknown): TRow | null => (data ? (data as TRow) : null)

const asRow = <TRow>(data: unknown, path: string, message: string): TRow => {
  const row = asMaybeRow<TRow>(data)

  if (!row) {
    throw createApiError(path, 500, message)
  }

  return row
}

const PROTOTYPE_USER = {
  clerkUserId: 'prototype-user',
  email: 'ana@nuba.app',
  displayName: 'Ana Nuba',
}

const DEFAULT_NOTIFICATIONS: NotificationsSettings = {
  smartRemindersEnabled: true,
  remindStart: true,
  remindPause: false,
  remindStop: true,
}

const DEFAULT_WORK_SETTINGS = {
  sameHoursEveryDay: true,
  defaultDailyMinutes: null,
  lunchCountsAsWorkTime: false,
  darkModeEnabled: true,
  autoCompleteForgottenCheckout: false,
  autoCompleteGraceMinutes: 30,
}

const AUTO_COMPLETE_LOG_FIELD = 'AUTO_COMPLETE'
const OUTING_LOG_FIELD = 'OUTING'
const SESSION_EDIT_LOG_FIELD = 'SESSION_EDIT'
const FALLBACK_AUTO_COMPLETE_TARGET_MINUTES = 480

const DAY_OF_WEEK_ORDER: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]

const DAY_OF_WEEK_TO_DB: Record<DayOfWeek, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
}

const DB_TO_DAY_OF_WEEK: Record<number, DayOfWeek> = {
  0: 'SUNDAY',
  1: 'MONDAY',
  2: 'TUESDAY',
  3: 'WEDNESDAY',
  4: 'THURSDAY',
  5: 'FRIDAY',
  6: 'SATURDAY',
  7: 'SUNDAY',
}

let currentUserPromise: Promise<AppUserRow> | null = null
let currentUserCacheKey: string | null = null

const ensureNotAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')
  }
}

const getBusinessDateFromInstant = (value: Date | string) =>
  formatInTimeZone(value, env.businessTimeZone, 'yyyy-MM-dd')

const getBusinessDateFromParts = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day))

const getDayOfWeek = (date: string): DayOfWeek =>
  DAY_OF_WEEK_ORDER[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7] ?? 'MONDAY'

const isWeekendDate = (date: string) => {
  const dayOfWeek = getDayOfWeek(date)
  return dayOfWeek === 'SATURDAY' || dayOfWeek === 'SUNDAY'
}

const minutesBetween = (startIso: string, endIso: string) =>
  Math.max(0, differenceInMinutes(new Date(endIso), new Date(startIso)))

const formatMinutesLabel = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.trunc(minutes))
  const hours = Math.floor(safeMinutes / 60)
  const remainder = safeMinutes % 60

  if (hours === 0) {
    return `${safeMinutes}m`
  }

  if (remainder === 0) {
    return `${hours}h`
  }

  return `${hours}h ${remainder.toString().padStart(2, '0')}m`
}

const buildAutoCompleteReason = (graceMinutes: number) =>
  `Cierre automático tras ${formatMinutesLabel(graceMinutes)} de margen por olvido de desfichaje.`

const normalizeAutoCompleteGraceMinutes = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(720, Math.max(0, Math.trunc(value)))
    : DEFAULT_WORK_SETTINGS.autoCompleteGraceMinutes

const parseAutoCompletePayload = (value: string | null) => {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as {
      endTime?: string
      graceMinutes?: number
    }

    if (
      typeof parsed.endTime !== 'string' ||
      typeof parsed.graceMinutes !== 'number' ||
      !Number.isFinite(parsed.graceMinutes)
    ) {
      return null
    }

    return {
      endTime: parsed.endTime,
      graceMinutes: normalizeAutoCompleteGraceMinutes(parsed.graceMinutes),
    }
  } catch {
    return null
  }
}

const buildAutoCloseNotice = ({
  endTime,
  graceMinutes,
  sessionId,
  workDate,
}: {
  endTime: string
  graceMinutes: number
  sessionId: string
  workDate: string
}): WorkSessionAutoCloseNotice => ({
  sessionId,
  workDate,
  endTime,
  graceMinutes,
  message: `Se completó el fichaje automáticamente a las ${formatInTimeZone(
    endTime,
    env.businessTimeZone,
    'HH:mm',
  )} tras ${formatMinutesLabel(graceMinutes)} de margen porque te olvidaste de hacerlo tú.`,
})

const normalizeBreakType = (value: string | null | undefined): BreakType =>
  value === 'OTHER' ? 'OTHER' : 'LUNCH'

const splitDisplayName = (displayName: string | null, email: string) => {
  const baseName = (displayName?.trim() || email.split('@')[0] || 'Nuba').trim()
  const [firstName = baseName, ...rest] = baseName.split(/\s+/)

  return {
    firstName,
    lastName: rest.length ? rest.join(' ') : null,
    fullName: baseName,
  }
}

const toCurrentUser = (row: AppUserRow): CurrentUser => {
  const names = splitDisplayName(row.display_name, row.email)

  return {
    id: row.id,
    email: row.email,
    firstName: names.firstName,
    lastName: names.lastName,
    fullName: names.fullName,
  }
}

const createApiError = (
  path: string,
  status: number,
  message: string,
  fieldErrors: FieldError[] = [],
) =>
  new ApiError({
    timestamp: new Date().toISOString(),
    status,
    error:
      status === 404
        ? 'Not Found'
        : status === 409
          ? 'Conflict'
          : status === 401
            ? 'Unauthorized'
            : 'Bad Request',
    message,
    path,
    fieldErrors,
  })

const toSupabaseApiError = (path: string, error: unknown, fallbackMessage: string) => {
  if (error instanceof ApiError) {
    return error
  }

  if (error instanceof Error) {
    const message = error.message || fallbackMessage
    const lowered = message.toLowerCase()

    if (lowered.includes('fetch failed') || lowered.includes('network')) {
      return createApiError(path, 503, 'No pudimos conectar con Supabase.', [])
    }

    if (lowered.includes('row-level security') || lowered.includes('permission')) {
      return createApiError(
        path,
        403,
        'Supabase ha bloqueado la operación. Revisa las policies de RLS o el acceso anónimo.',
        [],
      )
    }

    return createApiError(path, 500, message, [])
  }

  return createApiError(path, 500, fallbackMessage, [])
}

const createDefaultDailyGoals = (): DailyGoal[] => [
  { dayOfWeek: 'MONDAY', targetMinutes: 480 },
  { dayOfWeek: 'TUESDAY', targetMinutes: 480 },
  { dayOfWeek: 'WEDNESDAY', targetMinutes: 480 },
  { dayOfWeek: 'THURSDAY', targetMinutes: 480 },
  { dayOfWeek: 'FRIDAY', targetMinutes: 480 },
  { dayOfWeek: 'SATURDAY', targetMinutes: 0 },
  { dayOfWeek: 'SUNDAY', targetMinutes: 0 },
]

const sortDailyGoals = (goals: DailyGoal[]) =>
  [...goals].sort(
    (left, right) =>
      DAY_OF_WEEK_ORDER.indexOf(left.dayOfWeek) - DAY_OF_WEEK_ORDER.indexOf(right.dayOfWeek),
  )

const isWeekday = (dayOfWeek: DayOfWeek) =>
  dayOfWeek !== 'SATURDAY' && dayOfWeek !== 'SUNDAY'

const getUniformWeekdayTargetMinutes = (
  goals: DailyGoal[],
  workSettings: UserWorkSettingsRow,
) => {
  const weekdayTargets = DAY_OF_WEEK_ORDER
    .filter(isWeekday)
    .map((dayOfWeek) => goals.find((goal) => goal.dayOfWeek === dayOfWeek)?.targetMinutes)
    .filter((targetMinutes): targetMinutes is number => typeof targetMinutes === 'number')

  const defaultDailyMinutes =
    typeof workSettings.default_daily_minutes === 'number' &&
    Number.isFinite(workSettings.default_daily_minutes)
      ? Math.max(0, Math.trunc(workSettings.default_daily_minutes))
      : null

  return defaultDailyMinutes ?? weekdayTargets.find((targetMinutes) => targetMinutes > 0) ?? weekdayTargets[0] ?? 480
}

const normalizeGoalsForWorkSettings = (
  goals: DailyGoal[],
  workSettings: UserWorkSettingsRow,
) => {
  const sortedGoals = sortDailyGoals(goals)

  if (!workSettings.same_hours_every_day) {
    return sortedGoals
  }

  const goalsByDay = new Map(sortedGoals.map((goal) => [goal.dayOfWeek, goal.targetMinutes]))
  const weekdayTargetMinutes = getUniformWeekdayTargetMinutes(sortedGoals, workSettings)

  return DAY_OF_WEEK_ORDER.map((dayOfWeek) => ({
    dayOfWeek,
    targetMinutes: isWeekday(dayOfWeek)
      ? weekdayTargetMinutes
      : goalsByDay.get(dayOfWeek) ?? 0,
  }))
}

const getTargetMinutesForDate = (goals: DailyGoal[], date: string) =>
  goals.find((goal) => goal.dayOfWeek === getDayOfWeek(date))?.targetMinutes ?? 0

const normalizeSessionStatus = (
  session: WorkSessionRow,
  breaks: BreakSessionRow[],
): WorkSessionStatus => {
  if (session.end_time && session.status === 'EDITED') {
    return 'EDITED'
  }

  if (session.end_time) {
    return 'COMPLETED'
  }

  if (breaks.some((workBreak) => workBreak.end_time === null)) {
    return 'PAUSED'
  }

  return 'ACTIVE'
}

const getBreakMinutes = (workBreak: BreakSessionRow, nowIso: string) =>
  minutesBetween(workBreak.start_time, workBreak.end_time ?? nowIso)

const toWorkBreak = (workBreak: BreakSessionRow, nowIso: string): WorkBreak => ({
  id: workBreak.id,
  breakType: normalizeBreakType(workBreak.break_type),
  startTime: workBreak.start_time,
  endTime: workBreak.end_time,
  startedAt: workBreak.start_time,
  endedAt: workBreak.end_time,
  durationMinutes: getBreakMinutes(workBreak, nowIso),
  open: workBreak.end_time === null,
})

const toManualEdit = (log: ManualEditLogRow): ManualEdit => ({
  id: log.id,
  editedAt: log.edited_at,
  fieldChanged: log.field_changed,
  oldValue: log.old_value,
  newValue: log.new_value,
  reason: log.reason,
  notes: log.field_changed === AUTO_COMPLETE_LOG_FIELD ? null : log.new_value,
})

const getLatestSessionLog = (logs: ManualEditLogRow[]) =>
  [...logs]
    .filter((log) => log.field_changed !== OUTING_LOG_FIELD)
    .sort((left, right) => new Date(right.edited_at).getTime() - new Date(left.edited_at).getTime())
    .at(0) ?? null

const getAutoCloseNoticeFromLogs = (
  session: WorkSessionRow,
  logs: ManualEditLogRow[],
): WorkSessionAutoCloseNotice | null => {
  const autoCloseLog = [...logs]
    .filter((log) => log.field_changed === AUTO_COMPLETE_LOG_FIELD)
    .sort((left, right) => new Date(right.edited_at).getTime() - new Date(left.edited_at).getTime())
    .at(0)

  if (!autoCloseLog) {
    return null
  }

  const payload = parseAutoCompletePayload(autoCloseLog.new_value)
  const graceMinutes = payload?.graceMinutes ?? normalizeAutoCompleteGraceMinutes(null)
  const endTime = payload?.endTime ?? session.end_time

  if (!endTime) {
    return null
  }

  return buildAutoCloseNotice({
    sessionId: session.id,
    workDate: session.work_date,
    endTime,
    graceMinutes,
  })
}

const toWorkSession = (
  session: WorkSessionRow,
  breaks: BreakSessionRow[],
  manualEditLogs: ManualEditLogRow[],
  nowIso: string,
): WorkSession => {
  const sortedBreaks = [...breaks].sort(
    (left, right) => new Date(left.start_time).getTime() - new Date(right.start_time).getTime(),
  )
  const latestSessionLog = getLatestSessionLog(manualEditLogs)
  const isClosedSession = Boolean(session.end_time)
  const endTime = session.end_time ?? nowIso
  const breakMinutes = isClosedSession
    ? Math.max(0, Math.trunc(session.break_minutes ?? 0))
    : sortedBreaks.reduce((total, workBreak) => total + getBreakMinutes(workBreak, nowIso), 0)
  const workedMinutes = isClosedSession
    ? Math.max(0, Math.trunc(session.worked_minutes ?? 0))
    : Math.max(0, minutesBetween(session.start_time, endTime) - breakMinutes)

  return {
    id: session.id,
    status: normalizeSessionStatus(session, sortedBreaks),
    startTime: session.start_time,
    endTime: session.end_time,
    notes: session.notes,
    reason: latestSessionLog?.reason ?? null,
    editType: latestSessionLog?.field_changed ?? null,
    editedAt: latestSessionLog?.edited_at ?? null,
    autoCloseNotice: getAutoCloseNoticeFromLogs(session, manualEditLogs),
    workedMinutes,
    breakMinutes,
  }
}

const sortEventsAsc = (events: WorkTimelineEvent[]) =>
  [...events].sort((left, right) => {
    const leftInstant = left.occurredAt ?? left.timestamp ?? left.eventTime ?? ''
    const rightInstant = right.occurredAt ?? right.timestamp ?? right.eventTime ?? ''
    return new Date(leftInstant).getTime() - new Date(rightInstant).getTime()
  })

const createTimeline = (
  session: WorkSessionRow,
  breaks: BreakSessionRow[],
): WorkTimelineEvent[] => {
  const status = normalizeSessionStatus(session, breaks)
  const events: WorkTimelineEvent[] = [
    {
      type: 'SESSION_STARTED',
      occurredAt: session.start_time,
      sessionId: session.id,
      breakType: null,
      status,
    },
  ]

  const sortedBreaks = [...breaks].sort(
    (left, right) => new Date(left.start_time).getTime() - new Date(right.start_time).getTime(),
  )

  sortedBreaks.forEach((workBreak) => {
    const breakType = normalizeBreakType(workBreak.break_type)

    events.push({
      type: 'BREAK_STARTED',
      occurredAt: workBreak.start_time,
      sessionId: session.id,
      status: 'PAUSED',
      breakType,
    })

    if (workBreak.end_time) {
      events.push({
        type: 'BREAK_ENDED',
        occurredAt: workBreak.end_time,
        sessionId: session.id,
        status: session.end_time ? status : 'ACTIVE',
        breakType,
      })
    }
  })

  if (session.end_time) {
    events.push({
      type: 'SESSION_STOPPED',
      occurredAt: session.end_time,
      sessionId: session.id,
      breakType: null,
      status,
    })
  }

  return sortEventsAsc(events)
}

const getOutingsCount = (manualEditLogs: ManualEditLogRow[]) =>
  manualEditLogs.filter((log) => log.field_changed === OUTING_LOG_FIELD).length

const buildDaySummary = (
  date: string,
  bundles: SessionBundle[],
  goals: DailyGoal[],
  specialDay: CalendarSpecialDayRow | null,
  nowIso: string,
): DaySummary => {
  const workSessions = bundles.map((bundle) =>
    toWorkSession(bundle.session, bundle.breaks, bundle.manualEditLogs, nowIso),
  )
  const workedMinutes = workSessions.reduce(
    (total, session) => total + (session.workedMinutes ?? 0),
    0,
  )
  const breakMinutes = workSessions.reduce(
    (total, session) => total + (session.breakMinutes ?? 0),
    0,
  )
  const outingsCount = bundles.reduce(
    (total, bundle) => total + getOutingsCount(bundle.manualEditLogs),
    0,
  )
  const targetMinutes = getTargetMinutesForDate(goals, date)
  const hasOpenSession = bundles.some((bundle) => !bundle.session.end_time)
  const latestSession = [...bundles]
    .sort(
      (left, right) =>
        new Date(left.session.start_time).getTime() - new Date(right.session.start_time).getTime(),
    )
    .at(-1)?.session ?? null
  const remainingMinutes = Math.max(0, targetMinutes - workedMinutes)
  const projectedEndAt =
    hasOpenSession && latestSession
      ? addMinutes(new Date(nowIso), remainingMinutes).toISOString()
      : null
  const specialType = specialDay?.special_type.toUpperCase() ?? ''

  return {
    date,
    targetMinutes,
    workedMinutes,
    breakMinutes,
    outingsCount,
    extraMinutes: Math.max(0, workedMinutes - targetMinutes),
    remainingMinutes,
    projectedEndAt,
    weekend: isWeekendDate(date),
    holiday: specialType.includes('HOLIDAY') || specialType.includes('FEST'),
    specialDayName: specialDay?.name ?? null,
    specialDayType: specialDay?.special_type ?? null,
    sessionCount: bundles.length,
    hasOpenSession,
    latestStatus: latestSession
      ? normalizeSessionStatus(
          latestSession,
          bundles.find((bundle) => bundle.session.id === latestSession.id)?.breaks ?? [],
        )
      : null,
  }
}

const toCompletionRate = (workedMinutes: number, targetMinutes: number) =>
  targetMinutes > 0 ? Number(((workedMinutes / targetMinutes) * 100).toFixed(1)) : null

const getMinuteOfDayInBusinessTime = (value: string) => {
  const hours = Number(formatInTimeZone(value, env.businessTimeZone, 'H'))
  const minutes = Number(formatInTimeZone(value, env.businessTimeZone, 'm'))

  return hours * 60 + minutes
}

const averageRounded = (values: number[]) =>
  values.length
    ? Math.round(values.reduce((total, value) => total + value, 0) / values.length)
    : null

const buildDashboardDayContext = (
  date: string,
  bundles: SessionBundle[],
  goals: DailyGoal[],
  specialDay: CalendarSpecialDayRow | null,
  nowIso: string,
): DashboardDayContext => {
  const summary = buildDaySummary(date, bundles, goals, specialDay, nowIso)
  const workSessions = bundles
    .map((bundle) => toWorkSession(bundle.session, bundle.breaks, bundle.manualEditLogs, nowIso))
    .sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime())
  const completedEnds = workSessions
    .map((session) => session.endTime)
    .filter((value): value is string => Boolean(value))

  return {
    ...summary,
    firstStartTime: workSessions[0]?.startTime ?? null,
    lastEndTime: completedEnds.at(-1) ?? null,
    completionRate: toCompletionRate(summary.workedMinutes, summary.targetMinutes),
  }
}

const buildDashboardWorkPattern = (days: DashboardDayContext[]): DashboardWorkPattern => {
  const sampledDays = days.filter(
    (day) => day.sessionCount > 0 && day.targetMinutes > 0 && !day.weekend && !day.holiday,
  )
  const startMinutes = sampledDays
    .map((day) => day.firstStartTime)
    .filter((value): value is string => Boolean(value))
    .map(getMinuteOfDayInBusinessTime)
  const breakMinutes = sampledDays.map((day) => day.breakMinutes)
  const workedMinutes = sampledDays.map((day) => day.workedMinutes)
  const completionRates = sampledDays
    .map((day) => day.completionRate)
    .filter((value): value is number => value !== null)

  return {
    sampledDays: sampledDays.length,
    averageStartMinuteOfDay: averageRounded(startMinutes),
    averageBreakMinutes: averageRounded(breakMinutes) ?? 0,
    averageWorkedMinutes: averageRounded(workedMinutes) ?? 0,
    averageCompletionRate: averageRounded(completionRates),
  }
}

const groupBySessionId = <T extends { work_session_id: string }>(items: T[]) =>
  items.reduce<Record<string, T[]>>((accumulator, item) => {
    accumulator[item.work_session_id] ??= []
    accumulator[item.work_session_id].push(item)
    return accumulator
  }, {})

const getSessionBundles = async (
  sessions: WorkSessionRow[],
  signal?: AbortSignal,
): Promise<SessionBundle[]> => {
  ensureNotAborted(signal)

  if (!sessions.length) {
    return []
  }

  const sessionIds = sessions.map((session) => session.id)

  const [breaksResult, logsResult] = await Promise.all([
    supabase
      .from('break_sessions')
      .select('*')
      .in('work_session_id', sessionIds)
      .order('start_time', { ascending: true }),
    supabase
      .from('manual_edit_logs')
      .select('*')
      .in('work_session_id', sessionIds)
      .order('edited_at', { ascending: true }),
  ])

  if (breaksResult.error) {
    throw breaksResult.error
  }

  const manualEditLogs =
    logsResult.error && logsResult.error.message.toLowerCase().includes('permission')
      ? []
      : logsResult.error
        ? (() => {
            throw logsResult.error
          })()
        : asRows<ManualEditLogRow>(logsResult.data)

  const breaksBySessionId = groupBySessionId(asRows<BreakSessionRow>(breaksResult.data))
  const logsBySessionId = groupBySessionId(manualEditLogs)

  return sessions.map((session) => ({
    session,
    breaks: breaksBySessionId[session.id] ?? [],
    manualEditLogs: logsBySessionId[session.id] ?? [],
  }))
}

const listDatesBetween = (startDate: string, endDate: string) => {
  const dates: string[] = []
  let current = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current = addDays(current, 1)
  }

  return dates
}

const getWeekDates = (date: string) => {
  const pivot = new Date(`${date}T00:00:00Z`)
  const dayIndex = (pivot.getUTCDay() + 6) % 7
  const monday = subDays(pivot, dayIndex)
  const sunday = addDays(monday, 6)

  return listDatesBetween(
    monday.toISOString().slice(0, 10),
    sunday.toISOString().slice(0, 10),
  )
}

const getMonthDates = (year: number, month: number) => {
  const start = startOfMonth(getBusinessDateFromParts(year, month, 1))
  const end = endOfMonth(getBusinessDateFromParts(year, month, 1))

  return listDatesBetween(
    start.toISOString().slice(0, 10),
    end.toISOString().slice(0, 10),
  )
}

const sumPeriod = (days: DaySummary[]): DashboardPeriodSummary => {
  const totals = days.reduce(
    (accumulator, day) => ({
      targetMinutes: accumulator.targetMinutes + day.targetMinutes,
      workedMinutes: accumulator.workedMinutes + day.workedMinutes,
      breakMinutes: accumulator.breakMinutes + day.breakMinutes,
      extraMinutes: accumulator.extraMinutes + day.extraMinutes,
      remainingMinutes: accumulator.remainingMinutes + day.remainingMinutes,
    }),
    {
      targetMinutes: 0,
      workedMinutes: 0,
      breakMinutes: 0,
      extraMinutes: 0,
      remainingMinutes: 0,
    },
  )

  return {
    ...totals,
    completionRate:
      totals.targetMinutes > 0
        ? Number(((totals.workedMinutes / totals.targetMinutes) * 100).toFixed(1))
        : null,
  }
}

const getOrCreateCurrentUserRow = async (path: string) => {
  const authIdentity = (await getAuthIdentity()) ?? PROTOTYPE_USER
  const cacheKey = authIdentity.clerkUserId

  if (!currentUserPromise || currentUserCacheKey !== cacheKey) {
    currentUserCacheKey = cacheKey
    currentUserPromise = (async () => {
      const identity: AuthIdentity = authIdentity
      const byClerk = await supabase
        .from('app_users')
        .select('*')
        .eq('clerk_user_id', identity.clerkUserId)
        .limit(1)
        .maybeSingle()

      if (byClerk.error) {
        throw byClerk.error
      }

      const byClerkRow = asMaybeRow<AppUserRow>(byClerk.data)

      if (byClerkRow) {
        return byClerkRow
      }

      const byEmail = await supabase
        .from('app_users')
        .select('*')
        .eq('email', identity.email)
        .limit(1)
        .maybeSingle()

      if (byEmail.error) {
        throw byEmail.error
      }

      const byEmailRow = asMaybeRow<AppUserRow>(byEmail.data)

      if (byEmailRow) {
        return byEmailRow
      }

      const inserted = await supabase
        .from('app_users')
        .insert({
          clerk_user_id: identity.clerkUserId,
          email: identity.email,
          display_name: identity.displayName,
          timezone: env.businessTimeZone,
        })
        .select('*')
        .single()

      if (inserted.error) {
        throw inserted.error
      }

      return asRow<AppUserRow>(
        inserted.data,
        path,
        'Supabase no devolvió el usuario recién creado.',
      )
    })().catch((error) => {
      currentUserPromise = null
      currentUserCacheKey = null
      throw toSupabaseApiError(path, error, 'No pudimos resolver el usuario actual en Supabase.')
    })
  }

  return currentUserPromise
}

const invalidateCurrentUserCache = () => {
  currentUserPromise = null
  currentUserCacheKey = null
}

const ensureWorkSettingsRow = async (userId: string, path: string) => {
  const current = await supabase
    .from('user_work_settings')
    .select('*')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (current.error) {
    throw toSupabaseApiError(path, current.error, 'No pudimos cargar los ajustes de jornada.')
  }

  const currentRow = asMaybeRow<UserWorkSettingsRow>(current.data)

  if (currentRow) {
    return currentRow
  }

  const inserted = await supabase
    .from('user_work_settings')
    .insert({
      user_id: userId,
      same_hours_every_day: DEFAULT_WORK_SETTINGS.sameHoursEveryDay,
      default_daily_minutes: DEFAULT_WORK_SETTINGS.defaultDailyMinutes,
      lunch_counts_as_work_time: DEFAULT_WORK_SETTINGS.lunchCountsAsWorkTime,
      dark_mode_enabled: DEFAULT_WORK_SETTINGS.darkModeEnabled,
      auto_complete_forgotten_checkout:
        DEFAULT_WORK_SETTINGS.autoCompleteForgottenCheckout,
      auto_complete_grace_minutes: DEFAULT_WORK_SETTINGS.autoCompleteGraceMinutes,
    })
    .select('*')
    .single()

  if (inserted.error) {
    throw toSupabaseApiError(path, inserted.error, 'No pudimos crear los ajustes de jornada.')
  }

  return asRow<UserWorkSettingsRow>(
    inserted.data,
    path,
    'Supabase no devolvió los ajustes de jornada recién creados.',
  )
}

const ensureNotificationSettingsRow = async (userId: string, path: string) => {
  const current = await supabase
    .from('notification_settings')
    .select('*')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (current.error) {
    throw toSupabaseApiError(path, current.error, 'No pudimos cargar las notificaciones.')
  }

  const currentRow = asMaybeRow<NotificationSettingsRow>(current.data)

  if (currentRow) {
    return currentRow
  }

  const inserted = await supabase
    .from('notification_settings')
    .insert({
      user_id: userId,
      smart_reminders_enabled: DEFAULT_NOTIFICATIONS.smartRemindersEnabled,
      remind_start: DEFAULT_NOTIFICATIONS.remindStart,
      remind_pause: DEFAULT_NOTIFICATIONS.remindPause,
      remind_stop: DEFAULT_NOTIFICATIONS.remindStop,
    })
    .select('*')
    .single()

  if (inserted.error) {
    throw toSupabaseApiError(path, inserted.error, 'No pudimos crear las notificaciones.')
  }

  return asRow<NotificationSettingsRow>(
    inserted.data,
    path,
    'Supabase no devolvió las notificaciones recién creadas.',
  )
}

const toDailyGoal = (row: UserDailyGoalRow): DailyGoal => ({
  dayOfWeek: DB_TO_DAY_OF_WEEK[row.day_of_week] ?? 'MONDAY',
  targetMinutes: row.target_minutes,
})

const toPushSubscriptionRecord = (row: PushSubscriptionRow) => ({
  id: row.id,
  endpoint: row.endpoint,
  p256dh: row.p256dh_key,
  auth: row.auth_key,
  userAgent: row.user_agent,
  platform: row.platform,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastSeenAt: row.last_seen_at,
  lastSuccessAt: row.last_success_at,
  failureCount: row.failure_count,
})

const ensureDailyGoals = async (userId: string, path: string) => {
  const workSettings = await ensureWorkSettingsRow(userId, path)
  const current = await supabase
    .from('user_daily_goals')
    .select('*')
    .eq('user_id', userId)
    .order('day_of_week', { ascending: true })

  if (current.error) {
    throw toSupabaseApiError(path, current.error, 'No pudimos cargar los objetivos diarios.')
  }

  const rows = asRows<UserDailyGoalRow>(current.data)

  if (rows.length >= 7) {
    return normalizeGoalsForWorkSettings(rows.map(toDailyGoal), workSettings)
  }

  const existingByDay = new Map(rows.map((row) => [DB_TO_DAY_OF_WEEK[row.day_of_week] ?? 'MONDAY', row]))
  const defaults = createDefaultDailyGoals()
  const missing = defaults.filter((goal) => !existingByDay.has(goal.dayOfWeek))

  if (missing.length) {
    const inserted = await supabase.from('user_daily_goals').insert(
      missing.map((goal) => ({
        user_id: userId,
        day_of_week: DAY_OF_WEEK_TO_DB[goal.dayOfWeek],
        target_minutes: goal.targetMinutes,
      })),
    )

    if (inserted.error) {
      throw toSupabaseApiError(
        path,
        inserted.error,
        'No pudimos inicializar los objetivos diarios.',
      )
    }
  }

  const refreshed = await supabase
    .from('user_daily_goals')
    .select('*')
    .eq('user_id', userId)
    .order('day_of_week', { ascending: true })

  if (refreshed.error) {
    throw toSupabaseApiError(path, refreshed.error, 'No pudimos refrescar los objetivos diarios.')
  }

  return normalizeGoalsForWorkSettings(asRows<UserDailyGoalRow>(refreshed.data).map(toDailyGoal), workSettings)
}

const fetchSessionsForDate = async (userId: string, date: string, signal?: AbortSignal) => {
  ensureNotAborted(signal)

  const result = await supabase
    .from('work_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('work_date', date)
    .order('start_time', { ascending: true })

  if (result.error) {
    throw result.error
  }

  return getSessionBundles(asRows<WorkSessionRow>(result.data), signal)
}

const fetchSessionsInRange = async (
  userId: string,
  from: string,
  to: string,
  signal?: AbortSignal,
) => {
  ensureNotAborted(signal)

  const result = await supabase
    .from('work_sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('work_date', from)
    .lte('work_date', to)
    .order('start_time', { ascending: false })

  if (result.error) {
    throw result.error
  }

  return getSessionBundles(asRows<WorkSessionRow>(result.data), signal)
}

const fetchSpecialDaysInRange = async (from: string, to: string) => {
  const result = await supabase
    .from('calendar_special_days')
    .select('*')
    .gte('special_date', from)
    .lte('special_date', to)

  if (result.error) {
    if (
      result.error.message.toLowerCase().includes('permission') ||
      result.error.message.toLowerCase().includes('row-level security')
    ) {
      return []
    }

    throw result.error
  }

  return asRows<CalendarSpecialDayRow>(result.data)
}

const fetchOpenSessionBundle = async (userId: string, signal?: AbortSignal) => {
  ensureNotAborted(signal)

  const result = await supabase
    .from('work_sessions')
    .select('*')
    .eq('user_id', userId)
    .is('end_time', null)
    .order('start_time', { ascending: false })
    .limit(1)

  if (result.error) {
    throw result.error
  }

  const session = asRows<WorkSessionRow>(result.data)[0]

  if (!session) {
    return null
  }

  const [bundle] = await getSessionBundles([session], signal)
  return bundle ?? null
}

const resolveAutoCompleteTargetMinutes = (
  session: WorkSessionRow,
  workSettings: UserWorkSettingsRow,
) => {
  if (session.goal_minutes > 0) {
    return Math.max(0, Math.trunc(session.goal_minutes))
  }

  if (
    typeof workSettings.default_daily_minutes === 'number' &&
    Number.isFinite(workSettings.default_daily_minutes)
  ) {
    return Math.max(0, Math.trunc(workSettings.default_daily_minutes))
  }

  return FALLBACK_AUTO_COMPLETE_TARGET_MINUTES
}

const getAutoCompleteEndTime = (
  session: WorkSessionRow,
  breaks: BreakSessionRow[],
  workSettings: UserWorkSettingsRow,
) => {
  const graceMinutes = normalizeAutoCompleteGraceMinutes(
    workSettings.auto_complete_grace_minutes,
  )
  const closedBreakMinutes = breaks.reduce((total, workBreak) => {
    if (!workBreak.end_time) {
      return total
    }

    return total + minutesBetween(workBreak.start_time, workBreak.end_time)
  }, 0)
  const targetMinutes =
    resolveAutoCompleteTargetMinutes(session, workSettings) + closedBreakMinutes + graceMinutes

  return {
    graceMinutes,
    endTime: addMinutes(new Date(session.start_time), targetMinutes).toISOString(),
  }
}

const maybeAutoCompleteCarryOverSession = async ({
  nowIso,
  signal,
  userId,
  workSettings,
}: {
  nowIso: string
  signal?: AbortSignal
  userId: string
  workSettings: UserWorkSettingsRow
}): Promise<WorkSessionAutoCloseNotice | null> => {
  if (!workSettings.auto_complete_forgotten_checkout) {
    return null
  }

  const openBundle = await fetchOpenSessionBundle(userId, signal)

  if (!openBundle) {
    return null
  }

  const today = getBusinessDateFromInstant(nowIso)

  if (openBundle.session.work_date >= today) {
    return null
  }

  if (openBundle.breaks.some((workBreak) => workBreak.end_time === null)) {
    return null
  }

  const { endTime, graceMinutes } = getAutoCompleteEndTime(
    openBundle.session,
    openBundle.breaks,
    workSettings,
  )

  if (new Date(endTime) > new Date(nowIso)) {
    return null
  }

  await persistSessionMetrics(openBundle.session, openBundle.breaks, endTime, 'EDITED', {
    end_time: endTime,
    updated_at: nowIso,
  })

  const logInsert = await supabase.from('manual_edit_logs').insert({
    work_session_id: openBundle.session.id,
    user_id: userId,
    field_changed: AUTO_COMPLETE_LOG_FIELD,
    old_value: openBundle.session.end_time,
    new_value: JSON.stringify({ endTime, graceMinutes }),
    reason: buildAutoCompleteReason(graceMinutes),
    edited_at: nowIso,
  })

  if (logInsert.error) {
    throw logInsert.error
  }

  return buildAutoCloseNotice({
    sessionId: openBundle.session.id,
    workDate: openBundle.session.work_date,
    endTime,
    graceMinutes,
  })
}

const persistSessionMetrics = async (
  session: WorkSessionRow,
  breaks: BreakSessionRow[],
  nowIso: string,
  status: WorkSessionStatus,
  patch: Partial<WorkSessionRow> = {},
) => {
  const workSession = toWorkSession(session, breaks, [], nowIso)
  const updateResult = await supabase
    .from('work_sessions')
    .update({
      status,
      worked_minutes: workSession.workedMinutes ?? 0,
      break_minutes: workSession.breakMinutes ?? 0,
      extra_minutes: Math.max(0, (workSession.workedMinutes ?? 0) - session.goal_minutes),
      updated_at: nowIso,
      ...patch,
    })
    .eq('id', session.id)

  if (updateResult.error) {
    throw updateResult.error
  }
}

const buildHistoryResponse = (
  bundles: SessionBundle[],
  query: QueryParams | undefined,
  nowIso: string,
): WorkSessionHistoryResponse => {
  const page = Number(query?.page ?? 0)
  const size = Math.max(1, Number(query?.size ?? 12))
  const totalElements = bundles.length
  const totalPages = totalElements === 0 ? 0 : Math.ceil(totalElements / size)
  const offset = page * size
  const pageItems = bundles.slice(offset, offset + size)

  return {
    items: pageItems.map((bundle) =>
      toWorkSession(bundle.session, bundle.breaks, bundle.manualEditLogs, nowIso),
    ),
    totalElements,
    totalPages,
    page,
    size,
  }
}

const buildDetailResponse = (
  bundle: SessionBundle,
  daySummary: DaySummary,
  nowIso: string,
): WorkSessionDetailResponse => ({
  session: toWorkSession(bundle.session, bundle.breaks, bundle.manualEditLogs, nowIso),
  daySummary,
  breaks: bundle.breaks.map((workBreak) => toWorkBreak(workBreak, nowIso)),
  timeline: createTimeline(bundle.session, bundle.breaks),
  manualEdits: bundle.manualEditLogs
    .filter((log) => log.field_changed !== OUTING_LOG_FIELD)
    .map(toManualEdit)
    .sort(
      (left, right) =>
        new Date(left.editedAt ?? '').getTime() - new Date(right.editedAt ?? '').getTime(),
    ),
})

const validateRange = (path: string, from?: string, to?: string) => {
  if (from && to && from > to) {
    throw createApiError(path, 400, 'La fecha inicial no puede ser posterior a la final.', [
      { field: 'to', message: 'La fecha final debe ser igual o posterior a la inicial.' },
    ])
  }
}

const validateEditableSessionPayload = (
  payload: WorkSessionUpdatePayload,
  path: string,
  options: {
    allowOpenSession: boolean
  },
) => {
  const fieldErrors: FieldError[] = []
  const sessionStartMs = new Date(payload.startTime).getTime()
  const sessionEndMs = payload.endTime ? new Date(payload.endTime).getTime() : null

  if (sessionEndMs !== null && sessionEndMs <= sessionStartMs) {
    fieldErrors.push({
      field: 'endTime',
      message: 'La hora de fin debe ser posterior al inicio.',
    })
  }

  if (sessionEndMs === null && !options.allowOpenSession) {
    fieldErrors.push({
      field: 'endTime',
      message: 'Las jornadas cerradas deben mantener una hora de salida.',
    })
  }

  const breaksWithIndex = payload.breaks.map((workBreak, index) => ({
    index,
    ...workBreak,
  }))
  const sortedBreaks = [...breaksWithIndex].sort(
    (left, right) =>
      new Date(left.startTime).getTime() - new Date(right.startTime).getTime(),
  )

  sortedBreaks.forEach((workBreak, sortedIndex) => {
    const breakStartMs = new Date(workBreak.startTime).getTime()
    const breakEndMs = workBreak.endTime ? new Date(workBreak.endTime).getTime() : Number.NaN

    if (!workBreak.endTime && sessionEndMs !== null) {
      fieldErrors.push({
        field: `breaks.${workBreak.index}.endTime`,
        message: 'Si la jornada está cerrada, todos los descansos deben quedar cerrados.',
      })

      return
    }

    if (!workBreak.endTime && !options.allowOpenSession) {
      fieldErrors.push({
        field: `breaks.${workBreak.index}.endTime`,
        message: 'Solo las jornadas abiertas pueden mantener un descanso en curso.',
      })

      return
    }

    if (workBreak.endTime && breakEndMs <= breakStartMs) {
      fieldErrors.push({
        field: `breaks.${workBreak.index}.endTime`,
        message: 'Cada pausa debe tener un fin posterior al inicio.',
      })

      return
    }

    if (breakStartMs < sessionStartMs) {
      fieldErrors.push({
        field: `breaks.${workBreak.index}.startTime`,
        message: 'Las pausas deben quedar dentro de la jornada.',
      })
    }

    if (workBreak.endTime && sessionEndMs !== null && breakEndMs > sessionEndMs) {
      fieldErrors.push({
        field: `breaks.${workBreak.index}.startTime`,
        message: 'Las pausas deben quedar dentro de la jornada.',
      })
    }

    const previousBreak = sortedBreaks[sortedIndex - 1]
    if (previousBreak && !previousBreak.endTime) {
      fieldErrors.push({
        field: `breaks.${workBreak.index}.startTime`,
        message: 'Solo el último descanso puede seguir abierto.',
      })
    }

    if (previousBreak?.endTime) {
      const previousBreakEndMs = new Date(previousBreak.endTime).getTime()

      if (breakStartMs < previousBreakEndMs) {
        fieldErrors.push({
          field: `breaks.${workBreak.index}.startTime`,
          message: 'Las pausas no pueden solaparse entre sí.',
        })
      }
    }

    if (
      !workBreak.endTime &&
      sortedIndex !== sortedBreaks.length - 1
    ) {
      fieldErrors.push({
        field: `breaks.${workBreak.index}.endTime`,
        message: 'Solo el último descanso puede seguir abierto.',
      })
    }
  })

  if (fieldErrors.length) {
    throw createApiError(path, 400, 'Hay errores de validación en la jornada.', fieldErrors)
  }
}

const getUpdatedSessionStatus = (payload: WorkSessionUpdatePayload): WorkSessionStatus => {
  if (payload.endTime) {
    return 'EDITED'
  }

  return payload.breaks.some((workBreak) => workBreak.endTime === null)
    ? 'PAUSED'
    : 'ACTIVE'
}

export async function supabaseFrontendRequest<TSchema>(
  path: string,
  options: SupabaseFrontendRequestOptions = {},
) {
  const { method = 'GET', query, body, signal } = options

  ensureNotAborted(signal)
  const nowIso = new Date().toISOString()

  try {
    if (path === '/api/me' && method === 'GET') {
      return toCurrentUser(await getOrCreateCurrentUserRow(path)) as TSchema
    }

    if (path === '/api/me/settings' && method === 'GET') {
      const user = await getOrCreateCurrentUserRow(path)
      const workSettings = await ensureWorkSettingsRow(user.id, path)

      return {
        sameHoursEachDay: workSettings.same_hours_every_day,
        timeZone: user.timezone,
        autoCompleteForgottenCheckout: workSettings.auto_complete_forgotten_checkout,
        autoCompleteGraceMinutes: normalizeAutoCompleteGraceMinutes(
          workSettings.auto_complete_grace_minutes,
        ),
      } satisfies MeSettings as TSchema
    }

    if (path === '/api/me/settings' && method === 'PUT') {
      const user = await getOrCreateCurrentUserRow(path)
      const payload = body as MeSettings
      await ensureWorkSettingsRow(user.id, path)

      const [userUpdate, settingsUpdate] = await Promise.all([
        supabase
          .from('app_users')
          .update({
            timezone: payload.timeZone,
            updated_at: nowIso,
          })
          .eq('id', user.id),
        supabase
          .from('user_work_settings')
          .update({
            same_hours_every_day: payload.sameHoursEachDay,
            auto_complete_forgotten_checkout: payload.autoCompleteForgottenCheckout,
            auto_complete_grace_minutes: normalizeAutoCompleteGraceMinutes(
              payload.autoCompleteGraceMinutes,
            ),
            updated_at: nowIso,
          })
          .eq('user_id', user.id),
      ])

      if (userUpdate.error) {
        throw userUpdate.error
      }

      if (settingsUpdate.error) {
        throw settingsUpdate.error
      }

      invalidateCurrentUserCache()
      return undefined as TSchema
    }

    if (path === '/api/me/daily-goals' && method === 'GET') {
      const user = await getOrCreateCurrentUserRow(path)
      const goals = await ensureDailyGoals(user.id, path)

      return {
        goals,
      } satisfies DailyGoalsResponse as TSchema
    }

    if (path === '/api/me/daily-goals' && method === 'PUT') {
      const user = await getOrCreateCurrentUserRow(path)
      const payload = body as DailyGoalsResponse
      const current = await supabase
        .from('user_daily_goals')
        .select('*')
        .eq('user_id', user.id)

      if (current.error) {
        throw current.error
      }

      const currentByDay = new Map(
        asRows<UserDailyGoalRow>(current.data).map((goal) => [
          DB_TO_DAY_OF_WEEK[goal.day_of_week] ?? 'MONDAY',
          goal,
        ]),
      )

      for (const goal of payload.goals) {
        const currentRow = currentByDay.get(goal.dayOfWeek)

        if (currentRow) {
          const update = await supabase
            .from('user_daily_goals')
            .update({
              target_minutes: goal.targetMinutes,
              updated_at: nowIso,
            })
            .eq('id', currentRow.id)

          if (update.error) {
            throw update.error
          }
        } else {
          const insert = await supabase.from('user_daily_goals').insert({
            user_id: user.id,
            day_of_week: DAY_OF_WEEK_TO_DB[goal.dayOfWeek],
            target_minutes: goal.targetMinutes,
          })

          if (insert.error) {
            throw insert.error
          }
        }
      }

      return undefined as TSchema
    }

    if (path === '/api/notifications/settings' && method === 'GET') {
      const user = await getOrCreateCurrentUserRow(path)
      const notifications = await ensureNotificationSettingsRow(user.id, path)

      return {
        smartRemindersEnabled: notifications.smart_reminders_enabled,
        remindStart: notifications.remind_start,
        remindPause: notifications.remind_pause,
        remindStop: notifications.remind_stop,
      } satisfies NotificationsSettings as TSchema
    }

    if (path === '/api/notifications/settings' && method === 'PUT') {
      const user = await getOrCreateCurrentUserRow(path)
      const payload = body as NotificationsSettings
      await ensureNotificationSettingsRow(user.id, path)

      const update = await supabase
        .from('notification_settings')
        .update({
          smart_reminders_enabled: payload.smartRemindersEnabled,
          remind_start: payload.remindStart,
          remind_pause: payload.remindPause,
          remind_stop: payload.remindStop,
          updated_at: nowIso,
        })
        .eq('user_id', user.id)

      if (update.error) {
        throw update.error
      }

      return undefined as TSchema
    }

    if (path === '/api/notifications/push-subscriptions' && method === 'GET') {
      const user = await getOrCreateCurrentUserRow(path)
      const subscriptions = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (subscriptions.error) {
        throw subscriptions.error
      }

      return {
        items: asRows<PushSubscriptionRow>(subscriptions.data).map(toPushSubscriptionRecord),
      } satisfies PushSubscriptionsResponse as TSchema
    }

    if (path === '/api/notifications/push-subscriptions' && method === 'PUT') {
      const user = await getOrCreateCurrentUserRow(path)
      const payload = body as PushSubscriptionPayload
      await ensureNotificationSettingsRow(user.id, path)

      const upsert = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: user.id,
            endpoint: payload.endpoint,
            p256dh_key: payload.p256dh,
            auth_key: payload.auth,
            user_agent: payload.userAgent,
            platform: payload.platform,
            updated_at: nowIso,
            last_seen_at: nowIso,
          },
          {
            onConflict: 'endpoint',
          },
        )

      if (upsert.error) {
        throw upsert.error
      }

      return undefined as TSchema
    }

    if (path === '/api/notifications/push-subscriptions/unsubscribe' && method === 'POST') {
      const user = await getOrCreateCurrentUserRow(path)
      const payload = body as { endpoint?: string }

      if (!payload.endpoint) {
        throw createApiError(path, 400, 'Necesitamos el endpoint de la suscripción a eliminar.')
      }

      const remove = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', payload.endpoint)

      if (remove.error) {
        throw remove.error
      }

      return undefined as TSchema
    }

    if (path === '/api/work-sessions/today' && method === 'GET') {
      const user = await getOrCreateCurrentUserRow(path)
      const workSettings = await ensureWorkSettingsRow(user.id, path)
      await maybeAutoCompleteCarryOverSession({
        userId: user.id,
        signal,
        nowIso,
        workSettings,
      })
      const goals = await ensureDailyGoals(user.id, path)
      const today = getBusinessDateFromInstant(nowIso)
      const [bundles, specialDays, openBundle] = await Promise.all([
        fetchSessionsForDate(user.id, today, signal),
        fetchSpecialDaysInRange(today, today),
        fetchOpenSessionBundle(user.id, signal),
      ])
      const summary = buildDaySummary(
        today,
        bundles,
        goals,
        specialDays.find((day) => day.special_date === today) ?? null,
        nowIso,
      )
      const todayOpenBundle = bundles.find((bundle) => !bundle.session.end_time) ?? null
      const activeBreak =
        todayOpenBundle?.breaks.find((workBreak) => workBreak.end_time === null) ?? null
      const carryOverSession =
        openBundle && openBundle.session.work_date !== today
          ? toWorkSession(openBundle.session, openBundle.breaks, openBundle.manualEditLogs, nowIso)
          : null

      return {
        summary,
        paused: Boolean(activeBreak),
        activeBreak: activeBreak ? toWorkBreak(activeBreak, nowIso) : null,
        sessions: bundles.map((bundle) =>
          toWorkSession(bundle.session, bundle.breaks, bundle.manualEditLogs, nowIso),
        ),
        timeline: sortEventsAsc(
          bundles.flatMap((bundle) => createTimeline(bundle.session, bundle.breaks)),
        ),
        carryOverSession,
      } satisfies TodayWorkSessionsResponse as TSchema
    }

    if (path === '/api/work-sessions/start' && method === 'POST') {
      const user = await getOrCreateCurrentUserRow(path)
      const workSettings = await ensureWorkSettingsRow(user.id, path)
      const autoClosedPreviousSession = await maybeAutoCompleteCarryOverSession({
        userId: user.id,
        signal,
        nowIso,
        workSettings,
      })
      const openBundle = await fetchOpenSessionBundle(user.id, signal)

      if (openBundle) {
        if (openBundle.session.work_date !== getBusinessDateFromInstant(nowIso)) {
          throw createApiError(
            path,
            409,
            `Tienes una jornada pendiente del ${formatInTimeZone(
              openBundle.session.start_time,
              env.businessTimeZone,
              'dd/MM',
            )}. Ajusta la salida desde Calendario antes de fichar hoy.`,
          )
        }

        throw createApiError(path, 409, 'Ya existe una jornada abierta.')
      }

      const goals = await ensureDailyGoals(user.id, path)
      const date = getBusinessDateFromInstant(nowIso)
      const insert = await supabase.from('work_sessions').insert({
        user_id: user.id,
        work_date: date,
        start_time: nowIso,
        end_time: null,
        status: 'ACTIVE',
        goal_minutes: getTargetMinutesForDate(goals, date),
        worked_minutes: 0,
        break_minutes: 0,
        extra_minutes: 0,
        notes: 'Jornada iniciada desde el frontend con Supabase.',
        updated_at: nowIso,
      })

      if (insert.error) {
        throw insert.error
      }

      return {
        autoClosedPreviousSession,
      } as TSchema
    }

    if (path === '/api/work-sessions/pause' && method === 'POST') {
      const user = await getOrCreateCurrentUserRow(path)
      const bundle = await fetchOpenSessionBundle(user.id, signal)

      if (!bundle) {
        throw createApiError(path, 409, 'No hay una jornada activa para pausar.')
      }

      if (bundle.breaks.some((workBreak) => workBreak.end_time === null)) {
        throw createApiError(path, 409, 'La jornada ya se encuentra en pausa.')
      }

      const breakType = (body as { breakType?: BreakType } | undefined)?.breakType

      if (!breakType) {
        throw createApiError(path, 400, 'Debes indicar el tipo de pausa.')
      }

      await persistSessionMetrics(bundle.session, bundle.breaks, nowIso, 'PAUSED')

      const insertBreak = await supabase.from('break_sessions').insert({
        work_session_id: bundle.session.id,
        break_type: breakType,
        start_time: nowIso,
        end_time: null,
        duration_minutes: 0,
        updated_at: nowIso,
      })

      if (insertBreak.error) {
        throw insertBreak.error
      }

      return undefined as TSchema
    }

    if (path === '/api/work-sessions/outings' && method === 'POST') {
      const user = await getOrCreateCurrentUserRow(path)
      const bundle = await fetchOpenSessionBundle(user.id, signal)

      if (!bundle) {
        throw createApiError(path, 409, 'No hay una jornada activa para registrar una salida.')
      }

      if (bundle.breaks.some((workBreak) => workBreak.end_time === null)) {
        throw createApiError(
          path,
          409,
          'Reanuda la jornada antes de registrar una salida momentánea.',
        )
      }

      const currentCount = getOutingsCount(bundle.manualEditLogs)
      const insert = await supabase.from('manual_edit_logs').insert({
        work_session_id: bundle.session.id,
        user_id: user.id,
        field_changed: OUTING_LOG_FIELD,
        old_value: String(currentCount),
        new_value: String(currentCount + 1),
        reason: 'Salida momentánea registrada desde Home.',
        edited_at: nowIso,
      })

      if (insert.error) {
        throw insert.error
      }

      return undefined as TSchema
    }

    if (path === '/api/work-sessions/resume' && method === 'POST') {
      const user = await getOrCreateCurrentUserRow(path)
      const bundle = await fetchOpenSessionBundle(user.id, signal)

      if (!bundle) {
        throw createApiError(path, 409, 'No hay una jornada abierta para reanudar.')
      }

      const activeBreak = bundle.breaks.find((workBreak) => workBreak.end_time === null)

      if (!activeBreak) {
        throw createApiError(path, 409, 'No existe ninguna pausa abierta.')
      }

      const closeBreak = await supabase
        .from('break_sessions')
        .update({
          end_time: nowIso,
          duration_minutes: minutesBetween(activeBreak.start_time, nowIso),
          updated_at: nowIso,
        })
        .eq('id', activeBreak.id)

      if (closeBreak.error) {
        throw closeBreak.error
      }

      const refreshedBundle = await fetchOpenSessionBundle(user.id, signal)

      if (!refreshedBundle) {
        throw createApiError(path, 409, 'No encontramos la jornada abierta tras reanudar.')
      }

      await persistSessionMetrics(refreshedBundle.session, refreshedBundle.breaks, nowIso, 'ACTIVE')

      return undefined as TSchema
    }

    if (path === '/api/work-sessions/stop' && method === 'POST') {
      const user = await getOrCreateCurrentUserRow(path)
      const bundle = await fetchOpenSessionBundle(user.id, signal)

      if (!bundle) {
        throw createApiError(path, 409, 'No hay ninguna jornada abierta para finalizar.')
      }

      const activeBreak = bundle.breaks.find((workBreak) => workBreak.end_time === null)

      if (activeBreak) {
        const closeBreak = await supabase
          .from('break_sessions')
          .update({
            end_time: nowIso,
            duration_minutes: minutesBetween(activeBreak.start_time, nowIso),
            updated_at: nowIso,
          })
          .eq('id', activeBreak.id)

        if (closeBreak.error) {
          throw closeBreak.error
        }
      }

      const refreshedBundle = await fetchOpenSessionBundle(user.id, signal)

      if (!refreshedBundle) {
        throw createApiError(path, 409, 'No encontramos la jornada abierta para finalizar.')
      }

      await persistSessionMetrics(
        refreshedBundle.session,
        refreshedBundle.breaks,
        nowIso,
        'COMPLETED',
        {
          end_time: nowIso,
        },
      )

      return undefined as TSchema
    }

    if (path === '/api/work-sessions/history' && method === 'GET') {
      const user = await getOrCreateCurrentUserRow(path)
      const from = typeof query?.from === 'string' ? query.from : undefined
      const to = typeof query?.to === 'string' ? query.to : undefined

      validateRange(path, from, to)

      const rangeFrom = from ?? '1970-01-01'
      const rangeTo = to ?? '2999-12-31'
      const bundles = await fetchSessionsInRange(user.id, rangeFrom, rangeTo, signal)

      return buildHistoryResponse(bundles, query, nowIso) as TSchema
    }

    if (path === '/api/statistics/dashboard' && method === 'GET') {
      const user = await getOrCreateCurrentUserRow(path)
      const goals = await ensureDailyGoals(user.id, path)
      const todayDate = getBusinessDateFromInstant(nowIso)
      const monthDate = new Date(`${todayDate}T12:00:00Z`)
      const monthDates = getMonthDates(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1)
      const recentRangeFrom = subDays(new Date(`${todayDate}T00:00:00Z`), 42).toISOString().slice(0, 10)
      const dashboardRangeFrom = recentRangeFrom < monthDates[0]! ? recentRangeFrom : monthDates[0]!
      const dashboardRangeTo = monthDates.at(-1)!
      const [bundles, specialDays] = await Promise.all([
        fetchSessionsInRange(user.id, dashboardRangeFrom, dashboardRangeTo, signal),
        fetchSpecialDaysInRange(dashboardRangeFrom, dashboardRangeTo),
      ])

      const bundlesByDate = bundles.reduce<Record<string, SessionBundle[]>>((accumulator, bundle) => {
        const date = bundle.session.work_date
        accumulator[date] ??= []
        accumulator[date].push(bundle)
        return accumulator
      }, {})
      const specialDayByDate = new Map(specialDays.map((day) => [day.special_date, day]))

      const buildSummaryForDate = (date: string) =>
        buildDaySummary(
          date,
          bundlesByDate[date] ?? [],
          goals,
          specialDayByDate.get(date) ?? null,
          nowIso,
        )
      const buildDashboardDayForDate = (date: string) =>
        buildDashboardDayContext(
          date,
          bundlesByDate[date] ?? [],
          goals,
          specialDayByDate.get(date) ?? null,
          nowIso,
        )

      const today = buildSummaryForDate(todayDate)
      const currentWeekDays = getWeekDates(todayDate).map(buildDashboardDayForDate)
      const currentWeek = sumPeriod(currentWeekDays)
      const currentMonth = sumPeriod(monthDates.map(buildSummaryForDate))
      const recentDays = listDatesBetween(recentRangeFrom, todayDate).map(buildDashboardDayForDate)
      const recentPattern = buildDashboardWorkPattern(
        recentDays.filter((day) => day.date !== todayDate),
      )
      const openBundle = bundles.find((bundle) => !bundle.session.end_time) ?? null

      return {
        today,
        currentWeek,
        currentMonth,
        openSession: openBundle
          ? toWorkSession(openBundle.session, openBundle.breaks, openBundle.manualEditLogs, nowIso)
          : null,
        currentWeekDays,
        recentDays,
        recentPattern,
      } satisfies DashboardStatisticsResponse as TSchema
    }

    if (path === '/api/calendar/month' && method === 'GET') {
      const user = await getOrCreateCurrentUserRow(path)
      const year = Number(query?.year ?? new Date().getFullYear())
      const month = Number(query?.month ?? new Date().getMonth() + 1)
      const dates = getMonthDates(year, month)
      const [goals, bundles, specialDays] = await Promise.all([
        ensureDailyGoals(user.id, path),
        fetchSessionsInRange(user.id, dates[0]!, dates.at(-1)!, signal),
        fetchSpecialDaysInRange(dates[0]!, dates.at(-1)!),
      ])

      const bundlesByDate = bundles.reduce<Record<string, SessionBundle[]>>((accumulator, bundle) => {
        accumulator[bundle.session.work_date] ??= []
        accumulator[bundle.session.work_date].push(bundle)
        return accumulator
      }, {})
      const specialDayByDate = new Map(specialDays.map((day) => [day.special_date, day]))

      return {
        year,
        month,
        days: dates.map((date) =>
          buildDaySummary(
            date,
            bundlesByDate[date] ?? [],
            goals,
            specialDayByDate.get(date) ?? null,
            nowIso,
          ),
        ),
      } satisfies CalendarMonthResponse as TSchema
    }

    if (path === '/api/exports/csv' && method === 'GET') {
      const user = await getOrCreateCurrentUserRow(path)
      const from = typeof query?.from === 'string' ? query.from : undefined
      const to = typeof query?.to === 'string' ? query.to : undefined

      validateRange(path, from, to)

      const bundles = await fetchSessionsInRange(
        user.id,
        from ?? '1970-01-01',
        to ?? '2999-12-31',
        signal,
      )
      const currentUser = toCurrentUser(user)

      return buildWorkSessionsCsv(
        bundles.map((bundle) =>
          toWorkSession(bundle.session, bundle.breaks, bundle.manualEditLogs, nowIso),
        ),
        {
          from,
          generatedAt: nowIso,
          to,
          userName: currentUser.fullName ?? currentUser.email,
        },
      ) as TSchema
    }

    if (path === '/api/exports/pdf' && method === 'GET') {
      const user = await getOrCreateCurrentUserRow(path)
      const from = typeof query?.from === 'string' ? query.from : undefined
      const to = typeof query?.to === 'string' ? query.to : undefined

      validateRange(path, from, to)

      const bundles = await fetchSessionsInRange(
        user.id,
        from ?? '1970-01-01',
        to ?? '2999-12-31',
        signal,
      )
      const currentUser = toCurrentUser(user)

      return (await buildWorkSessionsPdf(
        bundles.map((bundle) =>
          toWorkSession(bundle.session, bundle.breaks, bundle.manualEditLogs, nowIso),
        ),
        {
          from,
          generatedAt: nowIso,
          to,
          userName: currentUser.fullName ?? currentUser.email,
        },
      )) as TSchema
    }

    const detailMatch = path.match(/^\/api\/work-sessions\/([^/]+)$/)
    if (detailMatch && method === 'GET') {
      const user = await getOrCreateCurrentUserRow(path)
      const sessionId = detailMatch[1]
      const sessionResult = await supabase
        .from('work_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (sessionResult.error) {
        throw sessionResult.error
      }

      const session = asMaybeRow<WorkSessionRow>(sessionResult.data)

      if (!session) {
        throw createApiError(path, 404, 'No encontramos la jornada solicitada.')
      }

      const [bundle] = await getSessionBundles([session], signal)
      const goals = await ensureDailyGoals(user.id, path)
      const specialDays = await fetchSpecialDaysInRange(
        session.work_date,
        session.work_date,
      )
      const sameDayBundles = await fetchSessionsForDate(user.id, session.work_date, signal)
      const daySummary = buildDaySummary(
        session.work_date,
        sameDayBundles,
        goals,
        specialDays.find((day) => day.special_date === session.work_date) ?? null,
        nowIso,
      )

      return buildDetailResponse(bundle, daySummary, nowIso) as TSchema
    }

    if (detailMatch && method === 'PUT') {
      const user = await getOrCreateCurrentUserRow(path)
      const sessionId = detailMatch[1]
      const payload = body as WorkSessionUpdatePayload

      const sessionResult = await supabase
        .from('work_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (sessionResult.error) {
        throw sessionResult.error
      }

      const session = asMaybeRow<WorkSessionRow>(sessionResult.data)

      if (!session) {
        throw createApiError(path, 404, 'No encontramos la jornada solicitada.')
      }

      validateEditableSessionPayload(payload, path, {
        allowOpenSession: !session.end_time,
      })

      const deleteBreaks = await supabase
        .from('break_sessions')
        .delete()
        .eq('work_session_id', sessionId)

      if (deleteBreaks.error) {
        throw deleteBreaks.error
      }

      if (payload.breaks.length) {
        const insertBreaks = await supabase.from('break_sessions').insert(
          payload.breaks.map((workBreak) => ({
            work_session_id: sessionId,
            break_type: workBreak.breakType,
            start_time: workBreak.startTime,
            end_time: workBreak.endTime,
            duration_minutes: workBreak.endTime
              ? minutesBetween(workBreak.startTime, workBreak.endTime)
              : 0,
            updated_at: nowIso,
          })),
        )

        if (insertBreaks.error) {
          throw insertBreaks.error
        }
      }

      const nextStatus = getUpdatedSessionStatus(payload)
      const metricsReferenceEndTime = payload.endTime ?? nowIso
      const recomputedBreakMinutes = payload.breaks.reduce(
        (total, workBreak) =>
          total +
          minutesBetween(workBreak.startTime, workBreak.endTime ?? metricsReferenceEndTime),
        0,
      )
      const workedMinutes = Math.max(
        0,
        minutesBetween(payload.startTime, metricsReferenceEndTime) - recomputedBreakMinutes,
      )
      const sessionUpdate = await supabase
        .from('work_sessions')
        .update({
          start_time: payload.startTime,
          end_time: payload.endTime ?? null,
          work_date: getBusinessDateFromInstant(payload.startTime),
          notes: payload.notes ?? null,
          status: nextStatus,
          worked_minutes: workedMinutes,
          break_minutes: recomputedBreakMinutes,
          extra_minutes: Math.max(0, workedMinutes - session.goal_minutes),
          updated_at: nowIso,
        })
        .eq('id', sessionId)

      if (sessionUpdate.error) {
        throw sessionUpdate.error
      }

      const logInsert = await supabase.from('manual_edit_logs').insert({
        work_session_id: sessionId,
        user_id: user.id,
        field_changed: SESSION_EDIT_LOG_FIELD,
        old_value: null,
        new_value: payload.notes ?? null,
        reason: payload.reason,
        edited_at: nowIso,
      })

      if (logInsert.error) {
        throw logInsert.error
      }

      return undefined as TSchema
    }
  } catch (error) {
    throw toSupabaseApiError(path, error, 'No pudimos completar la operación en Supabase.')
  }

  throw createApiError(path, 404, 'La ruta solicitada no está implementada en el adaptador Supabase.')
}
