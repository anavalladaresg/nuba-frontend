import { z } from 'zod'
import { dayOfWeekSchema } from './common'

export const currentUserSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable().optional().default(null),
  firstName: z.string().nullable().optional().default(null),
  lastName: z.string().nullable().optional().default(null),
  fullName: z.string().nullable().optional().default(null),
})

export const meSettingsSchema = z.object({
  sameHoursEachDay: z.boolean(),
  timeZone: z.string(),
})

export const dailyGoalSchema = z.object({
  dayOfWeek: dayOfWeekSchema,
  targetMinutes: z.number().int().min(0),
})

export const dailyGoalsResponseSchema = z.object({
  goals: z.array(dailyGoalSchema).default([]),
})

export const meSettingsPayloadSchema = meSettingsSchema

export const dailyGoalsPayloadSchema = z.object({
  goals: z.array(dailyGoalSchema).min(1),
})

export const notificationsSettingsSchema = z.object({
  smartRemindersEnabled: z.boolean(),
  remindStart: z.boolean(),
  remindPause: z.boolean(),
  remindStop: z.boolean(),
})

export type CurrentUser = z.infer<typeof currentUserSchema>
export type MeSettings = z.infer<typeof meSettingsSchema>
export type DailyGoal = z.infer<typeof dailyGoalSchema>
export type DailyGoalsResponse = z.infer<typeof dailyGoalsResponseSchema>
export type MeSettingsPayload = z.infer<typeof meSettingsPayloadSchema>
export type DailyGoalsPayload = z.infer<typeof dailyGoalsPayloadSchema>
export type NotificationsSettings = z.infer<typeof notificationsSettingsSchema>
