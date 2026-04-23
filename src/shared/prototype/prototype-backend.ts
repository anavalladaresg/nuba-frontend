import {
  addDays,
  addMinutes,
  differenceInMinutes,
  endOfMonth,
  startOfMonth,
  subDays,
} from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { env } from '../../config/env'
import { ApiError } from '../api/api-error'
import type { QueryParams, DayOfWeek, FieldError } from '../types/common'
import type {
  BreakType,
  DaySummary,
  ManualEdit,
  TodayWorkSessionsResponse,
  WorkBreak,
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
import { buildWorkSessionsCsv, buildWorkSessionsPdf } from '../utils/export-report'

type PrototypeRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: QueryParams
  body?: unknown
  signal?: AbortSignal
}

type StoredBreak = {
  id: string
  breakType: BreakType
  startTime: string
  endTime: string | null
}

type StoredSession = {
  id: string
  status: WorkSessionStatus
  startTime: string
  endTime: string | null
  notes: string | null
  reason: string | null
  breaks: StoredBreak[]
  timeline: WorkTimelineEvent[]
  manualEdits: ManualEdit[]
}

type PrototypeDb = {
  version: 2
  user: CurrentUser
  settings: MeSettings
  dailyGoals: DailyGoal[]
  notifications: NotificationsSettings
  sessions: StoredSession[]
  outingsByDate: Record<string, number>
}

const STORAGE_KEY = 'nuba.prototype.db.v1'
const PROTOTYPE_TOKEN = 'nuba-prototype-token'
const NETWORK_DELAY_MS = 120

const dayOfWeekByIndex: DayOfWeek[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
]

let memoryDb: PrototypeDb | null = null

type PersistedPrototypeDb = Omit<PrototypeDb, 'version' | 'outingsByDate'> & {
  version?: number
  outingsByDate?: unknown
}

const cloneValue = <T,>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

const getStorage = () => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

const normalizeOutingsByDate = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== 'object') {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([date, count]) => {
      if (typeof count !== 'number' || !Number.isFinite(count)) {
        return []
      }

      return [[date, Math.max(0, Math.trunc(count))]]
    }),
  )
}

const normalizePrototypeDb = (value: PersistedPrototypeDb): PrototypeDb => ({
  ...value,
  version: 2,
  outingsByDate: normalizeOutingsByDate(value.outingsByDate),
})

const createSessionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const createTimelineId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `timeline-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const createBreakId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `break-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const createManualEditId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `manual-edit-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })

const getBusinessDateFromInstant = (value: Date | string) =>
  formatInTimeZone(value, env.businessTimeZone, 'yyyy-MM-dd')

const getBusinessDateFromParts = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day))

const toBusinessIso = (date: string, time: string) =>
  fromZonedTime(`${date}T${time}`, env.businessTimeZone).toISOString()

const getDayOfWeek = (date: string): DayOfWeek =>
  dayOfWeekByIndex[new Date(`${date}T12:00:00Z`).getUTCDay()] ?? 'MONDAY'

const isWeekday = (dayOfWeek: DayOfWeek) => dayOfWeek !== 'SATURDAY' && dayOfWeek !== 'SUNDAY'

const getUniformWeekdayTargetMinutes = (db: PrototypeDb) => {
  const weekdayTargets = dayOfWeekByIndex
    .filter(isWeekday)
    .map((dayOfWeek) => db.dailyGoals.find((goal) => goal.dayOfWeek === dayOfWeek)?.targetMinutes)
    .filter((targetMinutes): targetMinutes is number => typeof targetMinutes === 'number')

  return weekdayTargets.find((targetMinutes) => targetMinutes > 0) ?? weekdayTargets[0] ?? 480
}

const getNormalizedDailyGoals = (db: PrototypeDb) => {
  if (!db.settings.sameHoursEachDay) {
    return [...db.dailyGoals]
  }

  const goalsByDay = new Map(db.dailyGoals.map((goal) => [goal.dayOfWeek, goal.targetMinutes]))
  const weekdayTargetMinutes = getUniformWeekdayTargetMinutes(db)

  return dayOfWeekByIndex
    .filter((dayOfWeek): dayOfWeek is DayOfWeek => Boolean(dayOfWeek))
    .map((dayOfWeek) => ({
      dayOfWeek,
      targetMinutes: isWeekday(dayOfWeek) ? weekdayTargetMinutes : goalsByDay.get(dayOfWeek) ?? 0,
    }))
}

const getTargetMinutesForDate = (db: PrototypeDb, date: string) =>
  getNormalizedDailyGoals(db).find((goal) => goal.dayOfWeek === getDayOfWeek(date))?.targetMinutes ?? 0

const isWeekendDate = (date: string) => {
  const dayOfWeek = getDayOfWeek(date)
  return dayOfWeek === 'SATURDAY' || dayOfWeek === 'SUNDAY'
}

const minutesBetween = (startIso: string, endIso: string) =>
  Math.max(0, differenceInMinutes(new Date(endIso), new Date(startIso)))

const getBreakMinutes = (workBreak: StoredBreak, nowIso: string) =>
  minutesBetween(workBreak.startTime, workBreak.endTime ?? nowIso)

const hasOpenBreak = (session: StoredSession) =>
  session.breaks.some((workBreak) => workBreak.endTime === null)

const normalizeSessionStatus = (session: StoredSession): WorkSessionStatus => {
  if (session.endTime && session.status === 'EDITED') {
    return 'EDITED'
  }

  if (session.endTime) {
    return 'COMPLETED'
  }

  if (hasOpenBreak(session)) {
    return 'PAUSED'
  }

  return 'ACTIVE'
}

const toWorkSession = (session: StoredSession, nowIso: string): WorkSession => {
  const endTime = session.endTime ?? nowIso
  const breakMinutes = session.breaks.reduce(
    (total, workBreak) => total + getBreakMinutes(workBreak, nowIso),
    0,
  )
  const workedMinutes = Math.max(0, minutesBetween(session.startTime, endTime) - breakMinutes)

  return {
    id: session.id,
    status: normalizeSessionStatus(session),
    startTime: session.startTime,
    endTime: session.endTime,
    notes: session.notes,
    reason: session.reason,
    workedMinutes,
    breakMinutes,
  }
}

const toWorkBreak = (workBreak: StoredBreak, nowIso: string): WorkBreak => ({
  id: workBreak.id,
  breakType: workBreak.breakType,
  startTime: workBreak.startTime,
  endTime: workBreak.endTime,
  startedAt: workBreak.startTime,
  endedAt: workBreak.endTime,
  durationMinutes: getBreakMinutes(workBreak, nowIso),
  open: workBreak.endTime === null,
})

const sortByStartAsc = (sessions: StoredSession[]) =>
  [...sessions].sort(
    (left, right) =>
      new Date(left.startTime).getTime() - new Date(right.startTime).getTime(),
  )

const sortByStartDesc = (sessions: StoredSession[]) =>
  [...sessions].sort(
    (left, right) =>
      new Date(right.startTime).getTime() - new Date(left.startTime).getTime(),
  )

const sortEventsAsc = (events: WorkTimelineEvent[]) =>
  [...events].sort((left, right) => {
    const leftInstant = left.occurredAt ?? left.timestamp ?? left.eventTime ?? ''
    const rightInstant = right.occurredAt ?? right.timestamp ?? right.eventTime ?? ''
    return new Date(leftInstant).getTime() - new Date(rightInstant).getTime()
  })

const getSessionsForDate = (db: PrototypeDb, date: string) =>
  sortByStartAsc(
    db.sessions.filter((session) => getBusinessDateFromInstant(session.startTime) === date),
  )

const getOpenSession = (db: PrototypeDb) =>
  db.sessions.find((session) => !session.endTime)

const getActiveBreak = (session: StoredSession | undefined, nowIso: string) => {
  if (!session) {
    return null
  }

  const activeBreak = session.breaks.find((workBreak) => workBreak.endTime === null)
  return activeBreak ? toWorkBreak(activeBreak, nowIso) : null
}

const buildDaySummary = (db: PrototypeDb, date: string, nowIso: string): DaySummary => {
  const sessions = getSessionsForDate(db, date)
  const workSessions = sessions.map((session) => toWorkSession(session, nowIso))
  const workedMinutes = workSessions.reduce(
    (total, session) => total + (session.workedMinutes ?? 0),
    0,
  )
  const breakMinutes = workSessions.reduce(
    (total, session) => total + (session.breakMinutes ?? 0),
    0,
  )
  const targetMinutes = getTargetMinutesForDate(db, date)
  const hasOpenSession = workSessions.some(
    (session) => session.status === 'ACTIVE' || session.status === 'PAUSED',
  )
  const latestSession = sessions.at(-1)
  const remainingMinutes = Math.max(0, targetMinutes - workedMinutes)
  const projectedEndAt =
    hasOpenSession && latestSession
      ? addMinutes(new Date(nowIso), remainingMinutes).toISOString()
      : null

  return {
    date,
    targetMinutes,
    workedMinutes,
    breakMinutes,
    outingsCount: db.outingsByDate[date] ?? 0,
    extraMinutes: Math.max(0, workedMinutes - targetMinutes),
    remainingMinutes,
    projectedEndAt,
    weekend: isWeekendDate(date),
    holiday: false,
    specialDayName: null,
    specialDayType: null,
    sessionCount: sessions.length,
    hasOpenSession,
    latestStatus: latestSession ? normalizeSessionStatus(latestSession) : null,
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
  db: PrototypeDb,
  date: string,
  nowIso: string,
): DashboardDayContext => {
  const summary = buildDaySummary(db, date, nowIso)
  const sessions = getSessionsForDate(db, date).map((session) => toWorkSession(session, nowIso))
  const completedEnds = sessions
    .map((session) => session.endTime)
    .filter((value): value is string => Boolean(value))

  return {
    ...summary,
    firstStartTime: sessions[0]?.startTime ?? null,
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

const buildTodayResponse = (db: PrototypeDb, nowIso: string): TodayWorkSessionsResponse => {
  const today = getBusinessDateFromInstant(nowIso)
  const sessions = getSessionsForDate(db, today)
  const openSession = getOpenSession(db)
  const summary = buildDaySummary(db, today, nowIso)

  return {
    summary,
    paused: Boolean(openSession && hasOpenBreak(openSession)),
    activeBreak: getActiveBreak(openSession, nowIso),
    sessions: sessions.map((session) => toWorkSession(session, nowIso)),
    timeline: sortEventsAsc(sessions.flatMap((session) => session.timeline)),
  }
}

const sumPeriod = (db: PrototypeDb, dates: string[], nowIso: string): DashboardPeriodSummary => {
  const days = dates.map((date) => buildDaySummary(db, date, nowIso))
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

const buildDashboardResponse = (db: PrototypeDb, nowIso: string): DashboardStatisticsResponse => {
  const todayDate = getBusinessDateFromInstant(nowIso)
  const monthDate = new Date(`${todayDate}T12:00:00Z`)
  const openSession = getOpenSession(db)
  const currentWeekDays = getWeekDates(todayDate).map((date) => buildDashboardDayContext(db, date, nowIso))
  const recentRangeFrom = subDays(new Date(`${todayDate}T00:00:00Z`), 42).toISOString().slice(0, 10)
  const recentDays = listDatesBetween(recentRangeFrom, todayDate).map((date) =>
    buildDashboardDayContext(db, date, nowIso),
  )
  const recentPattern = buildDashboardWorkPattern(
    recentDays.filter((day) => day.date !== todayDate),
  )

  return {
    today: buildDaySummary(db, todayDate, nowIso),
    currentWeek: sumPeriod(db, getWeekDates(todayDate), nowIso),
    currentMonth: sumPeriod(
      db,
      getMonthDates(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1),
      nowIso,
    ),
    openSession: openSession ? toWorkSession(openSession, nowIso) : null,
    currentWeekDays,
    recentDays,
    recentPattern,
  }
}

const buildCalendarResponse = (
  db: PrototypeDb,
  year: number,
  month: number,
  nowIso: string,
): CalendarMonthResponse => ({
  year,
  month,
  days: getMonthDates(year, month).map((date) => buildDaySummary(db, date, nowIso)),
})

const createTimeline = (
  sessionId: string,
  startTime: string,
  endTime: string | null,
  breaks: StoredBreak[],
  status: WorkSessionStatus,
) => {
  const events: WorkTimelineEvent[] = [
    {
      id: createTimelineId(),
      type: 'SESSION_STARTED',
      occurredAt: startTime,
      sessionId,
      breakType: null,
      status,
    },
  ]

  breaks.forEach((workBreak) => {
    events.push({
      id: createTimelineId(),
      type: 'BREAK_STARTED',
      occurredAt: workBreak.startTime,
      sessionId,
      status: 'PAUSED',
      breakType: workBreak.breakType,
    })

    if (workBreak.endTime) {
      events.push({
        id: createTimelineId(),
        type: 'BREAK_ENDED',
        occurredAt: workBreak.endTime,
        sessionId,
        status: endTime ? status : 'ACTIVE',
        breakType: workBreak.breakType,
      })
    }
  })

  if (endTime) {
    events.push({
      id: createTimelineId(),
      type: 'SESSION_STOPPED',
      occurredAt: endTime,
      sessionId,
      breakType: null,
      status,
    })
  }

  return sortEventsAsc(events)
}

const createStoredSession = ({
  id = createSessionId(),
  date,
  startClock,
  endClock,
  notes = null,
  reason = null,
  breaks = [],
  status = 'COMPLETED',
  manualEdits = [],
}: {
  id?: string
  date: string
  startClock: string
  endClock: string | null
  notes?: string | null
  reason?: string | null
  breaks?: Array<{ breakType: BreakType; startClock: string; endClock: string | null }>
  status?: WorkSessionStatus
  manualEdits?: ManualEdit[]
}): StoredSession => {
  const startTime = toBusinessIso(date, startClock)
  const endTime = endClock ? toBusinessIso(date, endClock) : null
  const storedBreaks: StoredBreak[] = breaks.map((workBreak) => ({
    id: createBreakId(),
    breakType: workBreak.breakType,
    startTime: toBusinessIso(date, workBreak.startClock),
    endTime: workBreak.endClock ? toBusinessIso(date, workBreak.endClock) : null,
  }))

  return {
    id,
    status,
    startTime,
    endTime,
    notes,
    reason,
    breaks: storedBreaks,
    timeline: createTimeline(id, startTime, endTime, storedBreaks, status),
    manualEdits,
  }
}

const createDefaultGoals = (): DailyGoal[] => [
  { dayOfWeek: 'MONDAY', targetMinutes: 480 },
  { dayOfWeek: 'TUESDAY', targetMinutes: 480 },
  { dayOfWeek: 'WEDNESDAY', targetMinutes: 480 },
  { dayOfWeek: 'THURSDAY', targetMinutes: 480 },
  { dayOfWeek: 'FRIDAY', targetMinutes: 480 },
  { dayOfWeek: 'SATURDAY', targetMinutes: 0 },
  { dayOfWeek: 'SUNDAY', targetMinutes: 0 },
]

const createSeedSessions = (now: Date) => {
  const sessions: StoredSession[] = []
  let generated = 0
  let offset = 18

  while (generated < 9 && offset > 0) {
    const date = getBusinessDateFromInstant(subDays(now, offset))
    offset -= 1

    if (isWeekendDate(date)) {
      continue
    }

    if (generated === 2) {
      sessions.push(
        createStoredSession({
          date,
          startClock: '08:45',
          endClock: '13:10',
          notes: 'Bloque de manana en oficina.',
          breaks: [{ breakType: 'OTHER', startClock: '11:10', endClock: '11:20' }],
        }),
        createStoredSession({
          date,
          startClock: '14:05',
          endClock: '18:20',
          notes: 'Bloque de tarde con reuniones.',
          breaks: [],
        }),
      )
      generated += 1
      continue
    }

    if (generated === 5) {
      const editedSession = createStoredSession({
        date,
        startClock: '09:08',
        endClock: '18:02',
        notes: 'Salida ajustada por visita a cliente.',
        reason: 'Correccion validada para reflejar la salida real.',
        breaks: [{ breakType: 'LUNCH', startClock: '14:02', endClock: '14:41' }],
        status: 'EDITED',
        manualEdits: [
          {
            id: createManualEditId(),
            editedAt: toBusinessIso(date, '18:15'),
            reason: 'Correccion manual del cierre.',
            notes: 'Se alineo la hora final con el registro validado.',
          },
        ],
      })
      sessions.push(editedSession)
      generated += 1
      continue
    }

    sessions.push(
      createStoredSession({
        date,
        startClock: generated % 3 === 0 ? '08:55' : '09:03',
        endClock: generated % 4 === 0 ? '18:05' : '17:42',
        notes:
          generated % 2 === 0
            ? 'Jornada prototipo persistida en local.'
            : 'Seguimiento operativo desde el frontend.',
        breaks: [
          {
            breakType: generated % 3 === 0 ? 'OTHER' : 'LUNCH',
            startClock: generated % 3 === 0 ? '11:32' : '13:58',
            endClock: generated % 3 === 0 ? '11:47' : '14:33',
          },
        ],
      }),
    )
    generated += 1
  }

  return sortByStartAsc(sessions)
}

const createSeedDb = (): PrototypeDb => {
  const now = new Date()

  return {
    version: 2,
    user: {
      id: 'prototype-user',
      email: 'ana@nuba.app',
      firstName: 'Ana',
      lastName: 'Nuba',
      fullName: 'Ana Nuba',
    },
    settings: {
      sameHoursEachDay: true,
      timeZone: env.businessTimeZone,
    },
    dailyGoals: createDefaultGoals(),
    notifications: {
      smartRemindersEnabled: true,
      remindStart: true,
      remindPause: false,
      remindStop: true,
    },
    sessions: createSeedSessions(now),
    outingsByDate: {},
  }
}

const loadDb = (): PrototypeDb => {
  if (memoryDb) {
    return cloneValue(memoryDb)
  }

  const storage = getStorage()
  const rawValue = storage?.getItem(STORAGE_KEY)

  if (rawValue) {
    try {
      const parsed = normalizePrototypeDb(JSON.parse(rawValue) as PersistedPrototypeDb)
      memoryDb = parsed
      return cloneValue(parsed)
    } catch {
      storage?.removeItem(STORAGE_KEY)
    }
  }

  const seeded = createSeedDb()
  memoryDb = seeded
  storage?.setItem(STORAGE_KEY, JSON.stringify(seeded))
  return cloneValue(seeded)
}

const saveDb = (db: PrototypeDb) => {
  memoryDb = cloneValue(db)
  getStorage()?.setItem(STORAGE_KEY, JSON.stringify(db))
}

const updateDb = <T,>(updater: (draft: PrototypeDb) => T) => {
  const db = loadDb()
  const result = updater(db)
  saveDb(db)
  return result
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

const requireSession = (db: PrototypeDb, sessionId: string, path: string) => {
  const session = db.sessions.find((item) => item.id === sessionId)

  if (!session) {
    throw createApiError(path, 404, 'No encontramos la jornada solicitada.')
  }

  return session
}

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
) => {
  const fieldErrors: FieldError[] = []

  if (new Date(payload.endTime) <= new Date(payload.startTime)) {
    fieldErrors.push({
      field: 'endTime',
      message: 'La hora de fin debe ser posterior al inicio.',
    })
  }

  payload.breaks.forEach((workBreak, index) => {
    if (!workBreak.endTime || new Date(workBreak.endTime) <= new Date(workBreak.startTime)) {
      fieldErrors.push({
        field: `breaks.${index}.endTime`,
        message: 'Cada pausa debe tener un fin posterior al inicio.',
      })
    }
  })

  if (fieldErrors.length) {
    throw createApiError(path, 400, 'Hay errores de validación en la jornada.', fieldErrors)
  }
}

const buildHistoryResponse = (
  db: PrototypeDb,
  nowIso: string,
  query: QueryParams | undefined,
): WorkSessionHistoryResponse => {
  const from = typeof query?.from === 'string' ? query.from : undefined
  const to = typeof query?.to === 'string' ? query.to : undefined
  const page = Number(query?.page ?? 0)
  const size = Math.max(1, Number(query?.size ?? 12))

  validateRange('/api/work-sessions/history', from, to)

  const filteredSessions = sortByStartDesc(db.sessions).filter((session) => {
    const date = getBusinessDateFromInstant(session.startTime)
    if (from && date < from) {
      return false
    }
    if (to && date > to) {
      return false
    }
    return true
  })

  const totalElements = filteredSessions.length
  const totalPages = totalElements === 0 ? 0 : Math.ceil(totalElements / size)
  const offset = page * size
  const pageItems = filteredSessions.slice(offset, offset + size)

  return {
    items: pageItems.map((session) => toWorkSession(session, nowIso)),
    totalElements,
    totalPages,
    page,
    size,
  }
}

const buildDetailResponse = (
  db: PrototypeDb,
  nowIso: string,
  sessionId: string,
): WorkSessionDetailResponse => {
  const session = requireSession(db, sessionId, `/api/work-sessions/${sessionId}`)
  const date = getBusinessDateFromInstant(session.startTime)

  return {
    session: toWorkSession(session, nowIso),
    daySummary: buildDaySummary(db, date, nowIso),
    breaks: session.breaks.map((workBreak) => toWorkBreak(workBreak, nowIso)),
    timeline: sortEventsAsc(session.timeline),
    manualEdits: [...session.manualEdits].sort(
      (left, right) =>
        new Date(left.editedAt ?? '').getTime() - new Date(right.editedAt ?? '').getTime(),
    ),
  }
}

const listSessionsForExport = (db: PrototypeDb, nowIso: string, query?: QueryParams) => {
  const history = buildHistoryResponse(db, nowIso, {
    ...query,
    page: 0,
    size: Number.MAX_SAFE_INTEGER,
  })

  return history.items
}

const ensureNotAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')
  }
}

export async function prototypeBackendRequest<TSchema>(
  path: string,
  options: PrototypeRequestOptions = {},
) {
  const { method = 'GET', query, body, signal } = options

  ensureNotAborted(signal)
  await wait(NETWORK_DELAY_MS)
  ensureNotAborted(signal)

  const nowIso = new Date().toISOString()

  if (path === '/api/work-sessions/today' && method === 'GET') {
    return buildTodayResponse(loadDb(), nowIso) as TSchema
  }

  if (path === '/api/work-sessions/start' && method === 'POST') {
    updateDb((db) => {
      if (getOpenSession(db)) {
        throw createApiError(path, 409, 'Ya existe una jornada abierta.')
      }

      const date = getBusinessDateFromInstant(nowIso)
      const session = createStoredSession({
        date,
        startClock: formatInTimeZone(nowIso, env.businessTimeZone, 'HH:mm'),
        endClock: null,
        status: 'ACTIVE',
        notes: 'Jornada iniciada desde el prototipo frontend.',
      })
      session.startTime = nowIso
      session.timeline = createTimeline(session.id, session.startTime, null, [], 'ACTIVE')
      db.sessions.push(session)
    })

    return undefined as TSchema
  }

  if (path === '/api/work-sessions/pause' && method === 'POST') {
    updateDb((db) => {
      const session = getOpenSession(db)

      if (!session) {
        throw createApiError(path, 409, 'No hay una jornada activa para pausar.')
      }

      if (hasOpenBreak(session)) {
        throw createApiError(path, 409, 'La jornada ya se encuentra en pausa.')
      }

      const nextBreakType = (body as { breakType?: BreakType } | undefined)?.breakType

      if (!nextBreakType) {
        throw createApiError(path, 400, 'Debes indicar el tipo de pausa.')
      }

      const workBreak: StoredBreak = {
        id: createBreakId(),
        breakType: nextBreakType,
        startTime: nowIso,
        endTime: null,
      }

      session.breaks.push(workBreak)
      session.status = 'PAUSED'
      session.timeline = createTimeline(
        session.id,
        session.startTime,
        session.endTime,
        session.breaks,
        'PAUSED',
      )
    })

    return undefined as TSchema
  }

  if (path === '/api/work-sessions/outings' && method === 'POST') {
    updateDb((db) => {
      const session = getOpenSession(db)

      if (!session) {
        throw createApiError(path, 409, 'No hay una jornada activa para registrar una salida.')
      }

      if (hasOpenBreak(session)) {
        throw createApiError(
          path,
          409,
          'Reanuda la jornada antes de registrar una salida momentánea.',
        )
      }

      const date = getBusinessDateFromInstant(nowIso)
      db.outingsByDate[date] = (db.outingsByDate[date] ?? 0) + 1
    })

    return undefined as TSchema
  }

  if (path === '/api/work-sessions/resume' && method === 'POST') {
    updateDb((db) => {
      const session = getOpenSession(db)

      if (!session) {
        throw createApiError(path, 409, 'No hay una jornada abierta para reanudar.')
      }

      const activeBreak = session.breaks.find((workBreak) => workBreak.endTime === null)

      if (!activeBreak) {
        throw createApiError(path, 409, 'No existe ninguna pausa abierta.')
      }

      activeBreak.endTime = nowIso
      session.status = 'ACTIVE'
      session.timeline = createTimeline(
        session.id,
        session.startTime,
        session.endTime,
        session.breaks,
        'ACTIVE',
      )
    })

    return undefined as TSchema
  }

  if (path === '/api/work-sessions/stop' && method === 'POST') {
    updateDb((db) => {
      const session = getOpenSession(db)

      if (!session) {
        throw createApiError(path, 409, 'No hay ninguna jornada abierta para finalizar.')
      }

      const activeBreak = session.breaks.find((workBreak) => workBreak.endTime === null)
      if (activeBreak) {
        activeBreak.endTime = nowIso
      }

      session.endTime = nowIso
      session.status = 'COMPLETED'
      session.timeline = createTimeline(
        session.id,
        session.startTime,
        session.endTime,
        session.breaks,
        'COMPLETED',
      )
    })

    return undefined as TSchema
  }

  if (path === '/api/work-sessions/history' && method === 'GET') {
    return buildHistoryResponse(loadDb(), nowIso, query) as TSchema
  }

  if (path === '/api/statistics/dashboard' && method === 'GET') {
    return buildDashboardResponse(loadDb(), nowIso) as TSchema
  }

  if (path === '/api/calendar/month' && method === 'GET') {
    const year = Number(query?.year ?? new Date().getFullYear())
    const month = Number(query?.month ?? new Date().getMonth() + 1)

    return buildCalendarResponse(loadDb(), year, month, nowIso) as TSchema
  }

  if (path === '/api/me' && method === 'GET') {
    return loadDb().user as TSchema
  }

  if (path === '/api/me/settings' && method === 'GET') {
    return loadDb().settings as TSchema
  }

  if (path === '/api/me/settings' && method === 'PUT') {
    updateDb((db) => {
      db.settings = {
        ...(body as MeSettings),
      }
    })

    return undefined as TSchema
  }

  if (path === '/api/me/daily-goals' && method === 'GET') {
    const db = loadDb()
    const response: DailyGoalsResponse = {
      goals: getNormalizedDailyGoals(db),
    }
    return response as TSchema
  }

  if (path === '/api/me/daily-goals' && method === 'PUT') {
    updateDb((db) => {
      db.dailyGoals = [...((body as DailyGoalsResponse).goals ?? [])]
    })

    return undefined as TSchema
  }

  if (path === '/api/notifications/settings' && method === 'GET') {
    return loadDb().notifications as TSchema
  }

  if (path === '/api/notifications/settings' && method === 'PUT') {
    updateDb((db) => {
      db.notifications = {
        ...(body as NotificationsSettings),
      }
    })

    return undefined as TSchema
  }

  if (path === '/api/exports/csv' && method === 'GET') {
    const db = loadDb()
    const from = typeof query?.from === 'string' ? query.from : undefined
    const to = typeof query?.to === 'string' ? query.to : undefined

    return buildWorkSessionsCsv(listSessionsForExport(db, nowIso, query), {
      from,
      generatedAt: nowIso,
      to,
      userName: db.user.fullName ?? db.user.email,
    }) as TSchema
  }

  if (path === '/api/exports/pdf' && method === 'GET') {
    const db = loadDb()
    const from = typeof query?.from === 'string' ? query.from : undefined
    const to = typeof query?.to === 'string' ? query.to : undefined

    return (await buildWorkSessionsPdf(listSessionsForExport(db, nowIso, query), {
      from,
      generatedAt: nowIso,
      to,
      userName: db.user.fullName ?? db.user.email,
    })) as TSchema
  }

  const detailMatch = path.match(/^\/api\/work-sessions\/([^/]+)$/)
  if (detailMatch && method === 'GET') {
    return buildDetailResponse(loadDb(), nowIso, detailMatch[1]) as TSchema
  }

  if (detailMatch && method === 'PUT') {
    const sessionId = detailMatch[1]
    const payload = body as WorkSessionUpdatePayload
    validateEditableSessionPayload(payload, path)

    updateDb((db) => {
      const session = requireSession(db, sessionId, path)

      if (!session.endTime) {
        throw createApiError(
          path,
          409,
          'Solo puedes editar jornadas cerradas en este prototipo.',
        )
      }

      session.startTime = payload.startTime
      session.endTime = payload.endTime
      session.notes = payload.notes ?? null
      session.reason = payload.reason
      session.status = 'EDITED'
      session.breaks = payload.breaks.map((workBreak) => ({
        id: workBreak.id ?? createBreakId(),
        breakType: workBreak.breakType,
        startTime: workBreak.startTime,
        endTime: workBreak.endTime,
      }))
      session.manualEdits.push({
        id: createManualEditId(),
        editedAt: nowIso,
        reason: payload.reason,
        notes: payload.notes ?? null,
      })
      session.timeline = createTimeline(
        session.id,
        session.startTime,
        session.endTime,
        session.breaks,
        'EDITED',
      )
    })

    return undefined as TSchema
  }

  throw createApiError(path, 404, 'La ruta solicitada no existe en el backend local.')
}

export const getPrototypeAccessToken = async () => PROTOTYPE_TOKEN
