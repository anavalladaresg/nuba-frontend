import { z } from 'zod'
import { isoDateSchema, isoDateTimeSchema } from './common'

export const breakTypeSchema = z.enum(['LUNCH', 'OTHER'])
export const workSessionStatusSchema = z.enum([
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'EDITED',
])
export const workTimelineEventTypeSchema = z.enum([
  'SESSION_STARTED',
  'BREAK_STARTED',
  'BREAK_ENDED',
  'SESSION_STOPPED',
])

export const daySummarySchema = z.object({
  date: isoDateSchema,
  targetMinutes: z.number().int().min(0),
  workedMinutes: z.number().int().min(0),
  breakMinutes: z.number().int().min(0),
  outingsCount: z.number().int().min(0).default(0),
  extraMinutes: z.number().int(),
  remainingMinutes: z.number().int(),
  projectedEndAt: isoDateTimeSchema.nullable().optional().default(null),
  weekend: z.boolean().default(false),
  holiday: z.boolean().default(false),
  specialDayName: z.string().nullable().optional().default(null),
  specialDayType: z.string().nullable().optional().default(null),
  sessionCount: z.number().int().min(0).default(0),
  hasOpenSession: z.boolean().default(false),
  latestStatus: workSessionStatusSchema.nullable().optional().default(null),
})

export const workBreakSchema = z.object({
  id: z.string().optional(),
  breakType: breakTypeSchema,
  startTime: isoDateTimeSchema.optional(),
  endTime: isoDateTimeSchema.nullable().optional().default(null),
  startedAt: isoDateTimeSchema.optional(),
  endedAt: isoDateTimeSchema.nullable().optional().default(null),
  durationMinutes: z.number().int().min(0).default(0),
  open: z.boolean().optional().default(false),
})

export const workSessionAutoCloseNoticeSchema = z.object({
  sessionId: z.string(),
  workDate: isoDateSchema,
  endTime: isoDateTimeSchema,
  graceMinutes: z.number().int().min(0),
  message: z.string(),
})

export const workSessionSchema = z.object({
  id: z.string(),
  status: workSessionStatusSchema,
  startTime: isoDateTimeSchema,
  endTime: isoDateTimeSchema.nullable().optional().default(null),
  notes: z.string().nullable().optional().default(null),
  reason: z.string().nullable().optional().default(null),
  editType: z.string().nullable().optional().default(null),
  editedAt: isoDateTimeSchema.nullable().optional().default(null),
  autoCloseNotice: workSessionAutoCloseNoticeSchema.nullable().optional().default(null),
  workedMinutes: z.number().int().min(0).optional(),
  breakMinutes: z.number().int().min(0).optional(),
})

export const workTimelineEventSchema = z.object({
  id: z.string().optional(),
  type: workTimelineEventTypeSchema,
  occurredAt: isoDateTimeSchema.optional(),
  timestamp: isoDateTimeSchema.optional(),
  eventTime: isoDateTimeSchema.optional(),
  breakType: breakTypeSchema.nullable().optional().default(null),
  status: workSessionStatusSchema.nullable().optional().default(null),
  sessionId: z.string().nullable().optional().default(null),
})

export const manualEditSchema = z.object({
  id: z.string().optional(),
  editedAt: isoDateTimeSchema.optional(),
  fieldChanged: z.string().nullable().optional().default(null),
  oldValue: z.string().nullable().optional().default(null),
  newValue: z.string().nullable().optional().default(null),
  reason: z.string().nullable().optional().default(null),
  notes: z.string().nullable().optional().default(null),
})

export const todayWorkSessionsResponseSchema = z.object({
  summary: daySummarySchema,
  paused: z.boolean(),
  activeBreak: workBreakSchema.nullable().default(null),
  sessions: z.array(workSessionSchema).default([]),
  timeline: z.array(workTimelineEventSchema).default([]),
  carryOverSession: workSessionSchema.nullable().default(null),
})

export const workSessionHistoryResponseSchema = z.object({
  items: z.array(workSessionSchema).default([]),
  totalElements: z.number().int().min(0).default(0),
  totalPages: z.number().int().min(0).default(0),
  page: z.number().int().min(0).optional(),
  size: z.number().int().min(1).optional(),
})

export const workSessionDetailResponseSchema = z.object({
  session: workSessionSchema,
  daySummary: daySummarySchema,
  breaks: z.array(workBreakSchema).default([]),
  timeline: z.array(workTimelineEventSchema).default([]),
  manualEdits: z.array(manualEditSchema).default([]),
})

export const workSessionStartResponseSchema = z.object({
  autoClosedPreviousSession: workSessionAutoCloseNoticeSchema.nullable().default(null),
})

export const workSessionPausePayloadSchema = z.object({
  breakType: breakTypeSchema,
})

export const workSessionUpdatePayloadSchema = z.object({
  startTime: isoDateTimeSchema,
  endTime: isoDateTimeSchema.nullable().optional().default(null),
  notes: z.string().trim().nullable().optional().default(null),
  reason: z.string().trim().min(3),
  breaks: z.array(
    z.object({
      id: z.string().optional(),
      breakType: breakTypeSchema,
      startTime: isoDateTimeSchema,
      endTime: isoDateTimeSchema.nullable(),
    }),
  ),
})

export type BreakType = z.infer<typeof breakTypeSchema>
export type WorkSessionStatus = z.infer<typeof workSessionStatusSchema>
export type WorkTimelineEventType = z.infer<typeof workTimelineEventTypeSchema>
export type DaySummary = z.infer<typeof daySummarySchema>
export type WorkBreak = z.infer<typeof workBreakSchema>
export type WorkSession = z.infer<typeof workSessionSchema>
export type WorkTimelineEvent = z.infer<typeof workTimelineEventSchema>
export type ManualEdit = z.infer<typeof manualEditSchema>
export type WorkSessionAutoCloseNotice = z.infer<typeof workSessionAutoCloseNoticeSchema>
export type TodayWorkSessionsResponse = z.infer<typeof todayWorkSessionsResponseSchema>
export type WorkSessionHistoryResponse = z.infer<typeof workSessionHistoryResponseSchema>
export type WorkSessionDetailResponse = z.infer<typeof workSessionDetailResponseSchema>
export type WorkSessionStartResponse = z.infer<typeof workSessionStartResponseSchema>
export type WorkSessionPausePayload = z.infer<typeof workSessionPausePayloadSchema>
export type WorkSessionUpdatePayload = z.infer<typeof workSessionUpdatePayloadSchema>
