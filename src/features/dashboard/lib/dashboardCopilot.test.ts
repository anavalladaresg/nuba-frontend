import { describe, expect, it } from 'vitest'
import type { DashboardStatisticsResponse } from '../../../shared/types/statistics'
import { buildDashboardCopilotModel } from './dashboardCopilot'

const baseDashboardData: DashboardStatisticsResponse = {
  today: {
    date: '2026-04-10',
    targetMinutes: 480,
    workedMinutes: 330,
    breakMinutes: 32,
    outingsCount: 0,
    extraMinutes: 0,
    remainingMinutes: 150,
    projectedEndAt: null,
    weekend: false,
    holiday: false,
    specialDayName: null,
    specialDayType: null,
    sessionCount: 1,
    hasOpenSession: true,
    latestStatus: 'ACTIVE',
  },
  currentWeek: {
    targetMinutes: 2400,
    workedMinutes: 2020,
    breakMinutes: 128,
    extraMinutes: 0,
    remainingMinutes: 380,
    completionRate: 84.2,
  },
  currentMonth: {
    targetMinutes: 8400,
    workedMinutes: 6910,
    breakMinutes: 402,
    extraMinutes: 140,
    remainingMinutes: 1490,
    completionRate: 82.3,
  },
  openSession: {
    id: 'session-1',
    status: 'ACTIVE',
    startTime: '2026-04-10T07:04:00.000Z',
    endTime: null,
    notes: null,
    reason: null,
    editType: null,
    editedAt: null,
    autoCloseNotice: null,
    workedMinutes: 330,
    breakMinutes: 32,
  },
  currentWeekDays: [
    {
      date: '2026-04-06',
      targetMinutes: 480,
      workedMinutes: 485,
      breakMinutes: 22,
      outingsCount: 0,
      extraMinutes: 5,
      remainingMinutes: 0,
      projectedEndAt: null,
      weekend: false,
      holiday: false,
      specialDayName: null,
      specialDayType: null,
      sessionCount: 1,
      hasOpenSession: false,
      latestStatus: 'COMPLETED',
      firstStartTime: '2026-04-06T07:01:00.000Z',
      lastEndTime: '2026-04-06T15:34:00.000Z',
      completionRate: 101,
    },
    {
      date: '2026-04-07',
      targetMinutes: 480,
      workedMinutes: 445,
      breakMinutes: 25,
      outingsCount: 0,
      extraMinutes: 0,
      remainingMinutes: 35,
      projectedEndAt: null,
      weekend: false,
      holiday: false,
      specialDayName: null,
      specialDayType: null,
      sessionCount: 1,
      hasOpenSession: false,
      latestStatus: 'COMPLETED',
      firstStartTime: '2026-04-07T07:07:00.000Z',
      lastEndTime: '2026-04-07T14:58:00.000Z',
      completionRate: 92.7,
    },
    {
      date: '2026-04-08',
      targetMinutes: 480,
      workedMinutes: 470,
      breakMinutes: 20,
      outingsCount: 0,
      extraMinutes: 0,
      remainingMinutes: 10,
      projectedEndAt: null,
      weekend: false,
      holiday: false,
      specialDayName: null,
      specialDayType: null,
      sessionCount: 1,
      hasOpenSession: false,
      latestStatus: 'COMPLETED',
      firstStartTime: '2026-04-08T07:03:00.000Z',
      lastEndTime: '2026-04-08T15:05:00.000Z',
      completionRate: 97.9,
    },
    {
      date: '2026-04-09',
      targetMinutes: 480,
      workedMinutes: 460,
      breakMinutes: 29,
      outingsCount: 0,
      extraMinutes: 0,
      remainingMinutes: 20,
      projectedEndAt: null,
      weekend: false,
      holiday: false,
      specialDayName: null,
      specialDayType: null,
      sessionCount: 1,
      hasOpenSession: false,
      latestStatus: 'COMPLETED',
      firstStartTime: '2026-04-09T07:06:00.000Z',
      lastEndTime: '2026-04-09T15:02:00.000Z',
      completionRate: 95.8,
    },
    {
      date: '2026-04-10',
      targetMinutes: 480,
      workedMinutes: 330,
      breakMinutes: 32,
      outingsCount: 0,
      extraMinutes: 0,
      remainingMinutes: 150,
      projectedEndAt: null,
      weekend: false,
      holiday: false,
      specialDayName: null,
      specialDayType: null,
      sessionCount: 1,
      hasOpenSession: true,
      latestStatus: 'ACTIVE',
      firstStartTime: '2026-04-10T07:04:00.000Z',
      lastEndTime: null,
      completionRate: 68.8,
    },
  ],
  recentDays: [
    {
      date: '2026-03-30',
      targetMinutes: 480,
      workedMinutes: 430,
      breakMinutes: 28,
      outingsCount: 0,
      extraMinutes: 0,
      remainingMinutes: 50,
      projectedEndAt: null,
      weekend: false,
      holiday: false,
      specialDayName: null,
      specialDayType: null,
      sessionCount: 1,
      hasOpenSession: false,
      latestStatus: 'COMPLETED',
      firstStartTime: '2026-03-30T07:16:00.000Z',
      lastEndTime: '2026-03-30T14:44:00.000Z',
      completionRate: 89.6,
    },
    {
      date: '2026-03-31',
      targetMinutes: 480,
      workedMinutes: 420,
      breakMinutes: 26,
      outingsCount: 0,
      extraMinutes: 0,
      remainingMinutes: 60,
      projectedEndAt: null,
      weekend: false,
      holiday: false,
      specialDayName: null,
      specialDayType: null,
      sessionCount: 1,
      hasOpenSession: false,
      latestStatus: 'COMPLETED',
      firstStartTime: '2026-03-31T07:14:00.000Z',
      lastEndTime: '2026-03-31T14:40:00.000Z',
      completionRate: 87.5,
    },
    {
      date: '2026-04-01',
      targetMinutes: 480,
      workedMinutes: 445,
      breakMinutes: 24,
      outingsCount: 0,
      extraMinutes: 0,
      remainingMinutes: 35,
      projectedEndAt: null,
      weekend: false,
      holiday: false,
      specialDayName: null,
      specialDayType: null,
      sessionCount: 1,
      hasOpenSession: false,
      latestStatus: 'COMPLETED',
      firstStartTime: '2026-04-01T07:12:00.000Z',
      lastEndTime: '2026-04-01T14:52:00.000Z',
      completionRate: 92.7,
    },
    {
      date: '2026-04-02',
      targetMinutes: 480,
      workedMinutes: 440,
      breakMinutes: 23,
      outingsCount: 0,
      extraMinutes: 0,
      remainingMinutes: 40,
      projectedEndAt: null,
      weekend: false,
      holiday: false,
      specialDayName: null,
      specialDayType: null,
      sessionCount: 1,
      hasOpenSession: false,
      latestStatus: 'COMPLETED',
      firstStartTime: '2026-04-02T07:11:00.000Z',
      lastEndTime: '2026-04-02T14:49:00.000Z',
      completionRate: 91.7,
    },
    {
      date: '2026-04-03',
      targetMinutes: 420,
      workedMinutes: 400,
      breakMinutes: 20,
      outingsCount: 0,
      extraMinutes: 0,
      remainingMinutes: 20,
      projectedEndAt: null,
      weekend: false,
      holiday: false,
      specialDayName: null,
      specialDayType: null,
      sessionCount: 1,
      hasOpenSession: false,
      latestStatus: 'COMPLETED',
      firstStartTime: '2026-04-03T07:08:00.000Z',
      lastEndTime: '2026-04-03T14:16:00.000Z',
      completionRate: 95.2,
    },
    ...[
      ...(
        [
          {
            date: '2026-04-06',
            workedMinutes: 485,
            breakMinutes: 22,
            firstStartTime: '2026-04-06T07:01:00.000Z',
            lastEndTime: '2026-04-06T15:34:00.000Z',
            completionRate: 101,
          },
          {
            date: '2026-04-07',
            workedMinutes: 445,
            breakMinutes: 25,
            firstStartTime: '2026-04-07T07:07:00.000Z',
            lastEndTime: '2026-04-07T14:58:00.000Z',
            completionRate: 92.7,
          },
          {
            date: '2026-04-08',
            workedMinutes: 470,
            breakMinutes: 20,
            firstStartTime: '2026-04-08T07:03:00.000Z',
            lastEndTime: '2026-04-08T15:05:00.000Z',
            completionRate: 97.9,
          },
          {
            date: '2026-04-09',
            workedMinutes: 460,
            breakMinutes: 29,
            firstStartTime: '2026-04-09T07:06:00.000Z',
            lastEndTime: '2026-04-09T15:02:00.000Z',
            completionRate: 95.8,
          },
          {
            date: '2026-04-10',
            workedMinutes: 330,
            breakMinutes: 32,
            firstStartTime: '2026-04-10T07:04:00.000Z',
            lastEndTime: null,
            completionRate: 68.8,
          },
        ] as const
      ).map((day) => ({
        date: day.date,
        targetMinutes: 480,
        workedMinutes: day.workedMinutes,
        breakMinutes: day.breakMinutes,
        outingsCount: 0,
        extraMinutes: Math.max(0, day.workedMinutes - 480),
        remainingMinutes: Math.max(0, 480 - day.workedMinutes),
        projectedEndAt: null,
        weekend: false,
        holiday: false,
        specialDayName: null,
        specialDayType: null,
        sessionCount: 1,
        hasOpenSession: false,
        latestStatus: 'COMPLETED' as const,
        firstStartTime: day.firstStartTime,
        lastEndTime: day.lastEndTime,
        completionRate: day.completionRate,
      })),
    ],
  ],
  recentPattern: {
    sampledDays: 9,
    averageStartMinuteOfDay: 547,
    averageBreakMinutes: 25,
    averageWorkedMinutes: 455,
    averageCompletionRate: 94,
  },
}

describe('buildDashboardCopilotModel', () => {
  it('generates hero insight from recent pattern', () => {
    const model = buildDashboardCopilotModel({ dashboard: baseDashboardData })

    expect(model.isEmpty).toBe(false)
    expect(model.hero.title).toContain('Entradas alrededor')
    expect(model.hero.badge).toBe('Observado')
  })

  it('builds compact habits section with three key items', () => {
    const model = buildDashboardCopilotModel({ dashboard: baseDashboardData })

    expect(model.habits.items.length).toBe(3)
    expect(model.habits.items[0]?.label).toBe('Entrada media')
    expect(model.habits.items[0]?.value).toBe('09:07')
    expect(model.habits.items[2]?.label).toBe('Pausa habitual')
    expect(model.habits.items[2]?.value).toBe('25m')
  })

  it('generates weekly trend with bar chart data', () => {
    const model = buildDashboardCopilotModel({ dashboard: baseDashboardData })

    expect(model.trend).toBeDefined()
    expect(model.trend?.title).toBe('Tendencia semanal')
    expect(model.trend?.bars.length).toBeGreaterThan(0)
    expect(model.trend?.bars.some((b) => b.isCurrent)).toBe(true)
  })

  it('calculates consistency score for stable patterns', () => {
    const model = buildDashboardCopilotModel({ dashboard: baseDashboardData })

    expect(model.consistency).toBeDefined()
    expect(model.consistency?.score).toBeGreaterThan(0)
    expect(model.consistency?.score).toBeLessThanOrEqual(100)
    expect(model.consistency?.interpretation).toBeTruthy()
  })

  it('handles empty data gracefully', () => {
    const emptyDashboard: DashboardStatisticsResponse = {
      today: baseDashboardData.today,
      currentWeek: baseDashboardData.currentWeek,
      currentMonth: baseDashboardData.currentMonth,
      openSession: null,
      currentWeekDays: [],
      recentDays: [],
      recentPattern: {
        sampledDays: 0,
        averageStartMinuteOfDay: null,
        averageBreakMinutes: 0,
        averageWorkedMinutes: 0,
        averageCompletionRate: null,
      },
    }

    const model = buildDashboardCopilotModel({ dashboard: emptyDashboard })

    expect(model.isEmpty).toBe(true)
    expect(model.hero.title).toContain('Bienvenido a Insights')
    expect(model.habits.items.length).toBe(0)
    expect(model.trend).toBeUndefined()
  })
})
