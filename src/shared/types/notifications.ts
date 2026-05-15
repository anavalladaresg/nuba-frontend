import { z } from 'zod'
import { isoDateTimeSchema } from './common'

export const pushSubscriptionRecordSchema = z.object({
  id: z.string(),
  endpoint: z.string().url(),
  p256dh: z.string(),
  auth: z.string(),
  userAgent: z.string().nullable().optional().default(null),
  platform: z.string().nullable().optional().default(null),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  lastSeenAt: isoDateTimeSchema,
  lastSuccessAt: isoDateTimeSchema.nullable().optional().default(null),
  failureCount: z.number().int().min(0).default(0),
})

export const pushSubscriptionPayloadSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().nullable().optional().default(null),
  platform: z.string().nullable().optional().default(null),
})

export const pushSubscriptionDeletePayloadSchema = z.object({
  endpoint: z.string().url(),
})

export const pushSubscriptionsResponseSchema = z.object({
  items: z.array(pushSubscriptionRecordSchema).default([]),
})

export type PushSubscriptionRecord = z.infer<typeof pushSubscriptionRecordSchema>
export type PushSubscriptionPayload = z.infer<typeof pushSubscriptionPayloadSchema>
export type PushSubscriptionDeletePayload = z.infer<typeof pushSubscriptionDeletePayloadSchema>
export type PushSubscriptionsResponse = z.infer<typeof pushSubscriptionsResponseSchema>
