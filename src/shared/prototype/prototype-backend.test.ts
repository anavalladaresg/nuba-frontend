import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MeSettings, NotificationsSettings, CurrentUser, DailyGoal } from '../types/settings'
import type {
  TodayWorkSessionsResponse,
  WorkSessionStartResponse,
  WorkSessionUpdatePayload,
} from '../types/work-session'
import {
  getPrototypeDbSnapshotForTests,
  prototypeBackendRequest,
  resetPrototypeDbForTests,
  setPrototypeDbForTests,
} from './prototype-backend'

type PrototypeDbSnapshot = ReturnType<typeof getPrototypeDbSnapshotForTests>
type StoredSession = PrototypeDbSnapshot['sessions'][number]

const baseUser: CurrentUser = {
  id: 'prototype-user',
  email: 'ana@nuba.app',
  firstName: 'Ana',
  lastName: 'Nuba',
  fullName: 'Ana Nuba',
}

const baseSettings: MeSettings = {
  sameHoursEachDay: true,
  timeZone: 'Europe/Madrid',
  autoCompleteForgottenCheckout: false,
  autoCompleteGraceMinutes: 30,
}

const baseGoals: DailyGoal[] = [
  { dayOfWeek: 'MONDAY', targetMinutes: 480 },
  { dayOfWeek: 'TUESDAY', targetMinutes: 480 },
  { dayOfWeek: 'WEDNESDAY', targetMinutes: 480 },
  { dayOfWeek: 'THURSDAY', targetMinutes: 480 },
  { dayOfWeek: 'FRIDAY', targetMinutes: 480 },
  { dayOfWeek: 'SATURDAY', targetMinutes: 0 },
  { dayOfWeek: 'SUNDAY', targetMinutes: 0 },
]

const baseNotifications: NotificationsSettings = {
  smartRemindersEnabled: true,
  remindStart: true,
  remindPause: false,
  remindStop: true,
}

const seedDb = (sessions: StoredSession[], settings: Partial<MeSettings> = {}) => {
  setPrototypeDbForTests({
    version: 2,
    user: baseUser,
    settings: {
      ...baseSettings,
      ...settings,
    },
    dailyGoals: baseGoals,
    notifications: baseNotifications,
    pushSubscriptions: [],
    sessions,
    outingsByDate: {},
  })
}

const runPrototypeRequest = async <TSchema>(
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    body?: unknown
  },
) => {
  const request = prototypeBackendRequest<TSchema>(path, options)
  await vi.advanceTimersByTimeAsync(200)
  return request
}

describe('prototype backend work sessions', () => {
  beforeEach(() => {
    resetPrototypeDbForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    resetPrototypeDbForTests()
  })

  it('allows correcting only the entry time while the session is still open', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-15T09:00:00.000Z'))

    seedDb([
      {
        id: 'session-open',
        status: 'ACTIVE',
        startTime: '2026-05-15T07:00:00.000Z',
        endTime: null,
        notes: null,
        reason: null,
        breaks: [],
        timeline: [],
        manualEdits: [],
      },
    ])

    const payload: WorkSessionUpdatePayload = {
      startTime: '2026-05-15T06:45:00.000Z',
      endTime: null,
      notes: null,
      reason: 'Ajuste manual desde calendario.',
      breaks: [],
    }

    await runPrototypeRequest<void>('/api/work-sessions/session-open', {
      method: 'PUT',
      body: payload,
    })

    const detail = await runPrototypeRequest<{
      session: {
        startTime: string
        endTime: string | null
        status: string
      }
    }>('/api/work-sessions/session-open')

    expect(detail.session.startTime).toBe('2026-05-15T06:45:00.000Z')
    expect(detail.session.endTime).toBeNull()
    expect(detail.session.status).toBe('ACTIVE')
  })

  it('auto-completes a previous open session before starting a new day when enabled', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-15T08:00:00.000Z'))

    seedDb(
      [
        {
          id: 'session-yesterday',
          status: 'ACTIVE',
          startTime: '2026-05-14T06:00:00.000Z',
          endTime: null,
          notes: null,
          reason: null,
          breaks: [],
          timeline: [],
          manualEdits: [],
        },
      ],
      {
        autoCompleteForgottenCheckout: true,
        autoCompleteGraceMinutes: 30,
      },
    )

    const response = await runPrototypeRequest<WorkSessionStartResponse>(
      '/api/work-sessions/start',
      {
        method: 'POST',
      },
    )

    expect(response.autoClosedPreviousSession).not.toBeNull()
    expect(response.autoClosedPreviousSession?.sessionId).toBe('session-yesterday')
    expect(response.autoClosedPreviousSession?.endTime).toBe('2026-05-14T14:30:00.000Z')

    const persisted = getPrototypeDbSnapshotForTests()

    const previousSession = persisted.sessions.find((session) => session.id === 'session-yesterday')
    const newSession = persisted.sessions.find((session) => session.id !== 'session-yesterday')

    expect(previousSession?.endTime).toBe('2026-05-14T14:30:00.000Z')
    expect(previousSession?.manualEdits.at(-1)?.fieldChanged).toBe('AUTO_COMPLETE')
    expect(newSession?.endTime).toBeNull()
  })

  it('auto-completes an open session from the same day once target plus grace has passed', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-15T14:00:00.000Z'))

    seedDb(
      [
        {
          id: 'session-today',
          status: 'ACTIVE',
          startTime: '2026-05-15T05:00:00.000Z',
          endTime: null,
          notes: null,
          reason: null,
          breaks: [],
          timeline: [],
          manualEdits: [],
        },
      ],
      {
        autoCompleteForgottenCheckout: true,
        autoCompleteGraceMinutes: 35,
      },
    )

    const response = await runPrototypeRequest<TodayWorkSessionsResponse>('/api/work-sessions/today')

    expect(response.summary.hasOpenSession).toBe(false)
    expect(response.sessions[0]?.id).toBe('session-today')
    expect(response.sessions[0]?.endTime).toBe('2026-05-15T13:35:00.000Z')
    expect(response.sessions[0]?.autoCloseNotice?.endTime).toBe('2026-05-15T13:35:00.000Z')

    const persisted = getPrototypeDbSnapshotForTests()
    const closedSession = persisted.sessions.find((session) => session.id === 'session-today')

    expect(closedSession?.endTime).toBe('2026-05-15T13:35:00.000Z')
    expect(closedSession?.manualEdits.at(-1)?.fieldChanged).toBe('AUTO_COMPLETE')
  })
})
