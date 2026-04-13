import { z } from 'zod'
import { daySummarySchema, workSessionSchema } from './work-session'
import { isoDateSchema, isoDateTimeSchema } from './common'

export const dashboardPeriodSummarySchema = z.object({
  label: z.string().optional(),
  targetMinutes: z.number().int().default(0),
  workedMinutes: z.number().int().default(0),
  breakMinutes: z.number().int().default(0),
  extraMinutes: z.number().int().default(0),
  remainingMinutes: z.number().int().default(0),
  completionRate: z.number().nullable().optional().default(null),
})

export const dashboardDayContextSchema = daySummarySchema.extend({
  firstStartTime: isoDateTimeSchema.nullable().optional().default(null),
  lastEndTime: isoDateTimeSchema.nullable().optional().default(null),
  completionRate: z.number().nullable().optional().default(null),
})

export const dashboardWorkPatternSchema = z.object({
  sampledDays: z.number().int().min(0).default(0),
  averageStartMinuteOfDay: z.number().int().nullable().optional().default(null),
  averageBreakMinutes: z.number().int().min(0).default(0),
  averageWorkedMinutes: z.number().int().min(0).default(0),
  averageCompletionRate: z.number().nullable().optional().default(null),
})

export const dashboardStatisticsResponseSchema = z.object({
  today: daySummarySchema,
  currentWeek: dashboardPeriodSummarySchema,
  currentMonth: dashboardPeriodSummarySchema,
  openSession: workSessionSchema.nullable().default(null),
  currentWeekDays: z.array(dashboardDayContextSchema).default([]),
  recentDays: z.array(dashboardDayContextSchema).default([]),
  recentPattern: dashboardWorkPatternSchema.default(() => ({
    sampledDays: 0,
    averageStartMinuteOfDay: null,
    averageBreakMinutes: 0,
    averageWorkedMinutes: 0,
    averageCompletionRate: null,
  })),
})

export const calendarDaySchema = daySummarySchema.extend({
  latestStatus: daySummarySchema.shape.latestStatus,
})

export const calendarMonthResponseSchema = z.object({
  year: z.number().int().optional().default(new Date().getFullYear()),
  month: z.number().int().optional().default(new Date().getMonth() + 1),
  days: z.array(calendarDaySchema).default([]),
})

export const weeklyStatisticsQuerySchema = z.object({
  weekStart: isoDateSchema,
})

export type DashboardPeriodSummary = z.infer<typeof dashboardPeriodSummarySchema>
export type DashboardDayContext = z.infer<typeof dashboardDayContextSchema>
export type DashboardWorkPattern = z.infer<typeof dashboardWorkPatternSchema>
export type DashboardStatisticsResponse = z.infer<typeof dashboardStatisticsResponseSchema>
export type CalendarDay = z.infer<typeof calendarDaySchema>
export type CalendarMonthResponse = z.infer<typeof calendarMonthResponseSchema>
