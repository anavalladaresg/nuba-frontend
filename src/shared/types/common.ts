import { z } from 'zod'

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const isoDateTimeSchema = z.string()

export const dayOfWeekSchema = z.enum([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
])

export const fieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
})

export const apiErrorSchema = z.object({
  timestamp: z.string().optional(),
  status: z.number().int().default(500),
  error: z.string().default('Unexpected Error'),
  message: z.string().default('Ha ocurrido un error inesperado.'),
  path: z.string().default('/'),
  fieldErrors: z.array(fieldErrorSchema).default([]),
})

export type DayOfWeek = z.infer<typeof dayOfWeekSchema>
export type FieldError = z.infer<typeof fieldErrorSchema>
export type ApiErrorPayload = z.infer<typeof apiErrorSchema>

export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined
>
