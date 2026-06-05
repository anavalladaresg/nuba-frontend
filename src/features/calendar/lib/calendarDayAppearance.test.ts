import { describe, expect, it } from 'vitest'
import type { CalendarDay } from '../../../shared/types/statistics'
import { getCalendarDayTone, getCalendarDayToneLabel } from './calendarDayAppearance'

const createCalendarDay = (overrides: Partial<CalendarDay> = {}): CalendarDay => ({
  date: '2026-05-14',
  targetMinutes: 480,
  workedMinutes: 420,
  breakMinutes: 0,
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
  latestStatus: 'EDITED',
  hasAutoCompletedSession: false,
  ...overrides,
})

describe('calendar day appearance', () => {
  it('uses the automatic tone for days closed by auto-complete logs', () => {
    const day = createCalendarDay({
      hasAutoCompletedSession: true,
      workedMinutes: 120,
      remainingMinutes: 360,
    })

    expect(getCalendarDayTone(day)).toBe('automatic')
    expect(getCalendarDayToneLabel('automatic')).toBe('Automático')
  })
})
