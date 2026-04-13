import type { CalendarDay } from '../../../shared/types/statistics'

export type CalendarDayTone = 'empty' | 'success' | 'warning' | 'danger'
export type CalendarDayKind = 'workday' | 'weekend' | 'holiday' | 'personal'

const holidayPatterns = ['HOLIDAY', 'FEST', 'BANK_HOLIDAY']
const personalDayPatterns = [
  'VACATION',
  'VACACIONES',
  'LEAVE',
  'DAY_OFF',
  'DAY OFF',
  'OFF',
  'LIBRE',
  'DESCANSO',
  'PERSONAL',
  'PTO',
]

const matchesPattern = (value: string, patterns: string[]) =>
  patterns.some((pattern) => value.includes(pattern))

export const getCalendarDayCompletion = (summary?: CalendarDay) => {
  if (!summary) {
    return 0
  }

  if (summary.targetMinutes <= 0) {
    return summary.workedMinutes > 0 || summary.hasOpenSession ? 1 : 0
  }

  return Math.max(0, Math.min(1, summary.workedMinutes / summary.targetMinutes))
}

export const getCalendarDayTone = (summary?: CalendarDay): CalendarDayTone => {
  if (!summary || (summary.workedMinutes <= 0 && !summary.hasOpenSession)) {
    return 'empty'
  }

  if (summary.targetMinutes <= 0) {
    return 'success'
  }

  const completion = summary.workedMinutes / summary.targetMinutes

  if (completion >= 1) {
    return 'success'
  }

  if (completion >= 0.75) {
    return 'warning'
  }

  return 'danger'
}

export const getCalendarDayKind = (summary?: CalendarDay): CalendarDayKind => {
  if (!summary) {
    return 'workday'
  }

  const specialType = summary.specialDayType?.toUpperCase() ?? ''

  if (summary.holiday || matchesPattern(specialType, holidayPatterns)) {
    return 'holiday'
  }

  if (
    matchesPattern(specialType, personalDayPatterns) ||
    Boolean(summary.specialDayName && summary.targetMinutes === 0 && !summary.weekend)
  ) {
    return 'personal'
  }

  if (summary.weekend) {
    return 'weekend'
  }

  return 'workday'
}

export const getCalendarDayToneLabel = (tone: CalendarDayTone) => {
  switch (tone) {
    case 'success':
      return 'Cumplido'
    case 'warning':
      return 'Cerca'
    case 'danger':
      return 'Bajo'
    case 'empty':
      return 'Sin datos'
  }
}

export const formatCalendarWorkedHours = (minutes: number) => {
  if (minutes <= 0) {
    return '--'
  }

  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60

  if (remainder === 0) {
    return `${hours}h`
  }

  return `${hours}h ${remainder.toString().padStart(2, '0')}`
}
