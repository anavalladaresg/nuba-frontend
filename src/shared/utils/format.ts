import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { env } from '../../config/env'
import type { DayOfWeek } from '../types/common'
import type { BreakType, WorkSessionStatus, WorkTimelineEvent } from '../types/work-session'

const safeDate = (value: string) => parseISO(value)

export const formatMinutesCompact = (minutes: number) => {
  const absoluteMinutes = Math.abs(minutes)
  const hours = Math.floor(absoluteMinutes / 60)
  const remainder = absoluteMinutes % 60
  const prefix = minutes < 0 ? '-' : ''

  return `${prefix}${hours}h ${remainder.toString().padStart(2, '0')}m`
}

export const formatClockFromSeconds = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const remainder = safeSeconds % 60

  return [hours, minutes, remainder].map((item) => item.toString().padStart(2, '0')).join(':')
}

export const formatMinutesAsClock = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.floor(minutes))
  const hours = Math.floor(safeMinutes / 60)
  const remainder = safeMinutes % 60

  return `${hours}:${remainder.toString().padStart(2, '0')}`
}

export const formatDateLong = (value: string) =>
  formatInTimeZone(value, env.businessTimeZone, "EEEE d 'de' MMMM", {
    locale: es,
  })

export const formatDateShort = (value: string) =>
  formatInTimeZone(value, env.businessTimeZone, 'dd MMM yyyy', {
    locale: es,
  })

export const formatTime = (value: string) =>
  formatInTimeZone(value, env.businessTimeZone, 'HH:mm')

export const formatDateTime = (value: string) =>
  formatInTimeZone(value, env.businessTimeZone, "dd MMM yyyy, HH:mm", {
    locale: es,
  })

export const getTimelineEventInstant = (event: WorkTimelineEvent) =>
  event.occurredAt ?? event.timestamp ?? event.eventTime ?? null

export const formatTimelineEventTime = (event: WorkTimelineEvent) => {
  const instant = getTimelineEventInstant(event)
  return instant ? formatTime(instant) : '--:--'
}

export const getStatusLabel = (status: WorkSessionStatus) => {
  switch (status) {
    case 'ACTIVE':
      return 'Activa'
    case 'PAUSED':
      return 'En pausa'
    case 'COMPLETED':
      return 'Completada'
    case 'EDITED':
      return 'Editada'
  }
}

export const getBreakTypeLabel = (breakType: BreakType) => {
  switch (breakType) {
    case 'LUNCH':
      return 'Comida'
    case 'OTHER':
      return 'Pausa'
  }
}

export const getDayOfWeekLabel = (day: DayOfWeek) => {
  switch (day) {
    case 'MONDAY':
      return 'Lunes'
    case 'TUESDAY':
      return 'Martes'
    case 'WEDNESDAY':
      return 'Miércoles'
    case 'THURSDAY':
      return 'Jueves'
    case 'FRIDAY':
      return 'Viernes'
    case 'SATURDAY':
      return 'Sábado'
    case 'SUNDAY':
      return 'Domingo'
  }
}

export const toDatetimeLocalValue = (isoDateTime: string | null | undefined) => {
  if (!isoDateTime) {
    return ''
  }

  return formatInTimeZone(isoDateTime, env.businessTimeZone, "yyyy-MM-dd'T'HH:mm")
}

export const fromDatetimeLocalValue = (value: string) => {
  if (!value) {
    return null
  }

  return fromZonedTime(value, env.businessTimeZone).toISOString()
}

export const formatInputDate = (value: Date) => format(value, 'yyyy-MM-dd')

export const parseBusinessDate = (value: string) =>
  formatInTimeZone(safeDate(`${value}T00:00:00Z`), env.businessTimeZone, 'yyyy-MM-dd')
