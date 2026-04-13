import { describe, expect, it } from 'vitest'
import type { TodayWorkSessionsResponse } from '../../../shared/types/work-session'
import { calculateLiveTodayMetrics } from './useLiveTodayMetrics'

const createTodayData = (
  overrides: Partial<TodayWorkSessionsResponse> = {},
): TodayWorkSessionsResponse => ({
  summary: {
    date: '2026-04-13',
    targetMinutes: 480,
    workedMinutes: 2,
    breakMinutes: 0,
    outingsCount: 0,
    extraMinutes: 0,
    remainingMinutes: 478,
    projectedEndAt: null,
    weekend: false,
    holiday: false,
    specialDayName: null,
    specialDayType: null,
    sessionCount: 1,
    hasOpenSession: true,
    latestStatus: 'ACTIVE',
  },
  paused: false,
  activeBreak: null,
  sessions: [
    {
      id: 'session-1',
      status: 'ACTIVE',
      startTime: '2026-04-13T08:00:00.000Z',
      endTime: null,
      notes: null,
      reason: null,
      workedMinutes: 2,
      breakMinutes: 0,
    },
  ],
  timeline: [
    {
      type: 'SESSION_STARTED',
      occurredAt: '2026-04-13T08:00:00.000Z',
      sessionId: 'session-1',
      breakType: null,
      status: 'ACTIVE',
    },
  ],
  ...overrides,
})

describe('calculateLiveTodayMetrics', () => {
  it('preserves live seconds after reopening an active session', () => {
    const nowMs = new Date('2026-04-13T08:02:07.000Z').getTime()

    expect(calculateLiveTodayMetrics(createTodayData(), nowMs).liveWorkedSeconds).toBe(127)
  })

  it('freezes worked time at the exact second when the app reopens during a pause', () => {
    const nowMs = new Date('2026-04-13T08:05:00.000Z').getTime()
    const todayData = createTodayData({
      summary: {
        ...createTodayData().summary,
        breakMinutes: 2,
        latestStatus: 'PAUSED',
      },
      paused: true,
      activeBreak: {
        breakType: 'LUNCH',
        startTime: '2026-04-13T08:02:07.000Z',
        startedAt: '2026-04-13T08:02:07.000Z',
        endTime: null,
        endedAt: null,
        durationMinutes: 2,
        open: true,
      },
      sessions: [
        {
          id: 'session-1',
          status: 'PAUSED',
          startTime: '2026-04-13T08:00:00.000Z',
          endTime: null,
          notes: null,
          reason: null,
          workedMinutes: 2,
          breakMinutes: 2,
        },
      ],
      timeline: [
        {
          type: 'SESSION_STARTED',
          occurredAt: '2026-04-13T08:00:00.000Z',
          sessionId: 'session-1',
          breakType: null,
          status: 'ACTIVE',
        },
        {
          type: 'BREAK_STARTED',
          occurredAt: '2026-04-13T08:02:07.000Z',
          sessionId: 'session-1',
          breakType: 'LUNCH',
          status: 'PAUSED',
        },
      ],
    })

    const liveMetrics = calculateLiveTodayMetrics(todayData, nowMs)

    expect(liveMetrics.liveWorkedSeconds).toBe(127)
    expect(liveMetrics.liveBreakSeconds).toBe(173)
  })
})
