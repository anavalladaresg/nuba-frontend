import { apiClient } from '../../../shared/api/api-client'
import {
  currentUserSchema,
  dailyGoalsPayloadSchema,
  dailyGoalsResponseSchema,
  meSettingsPayloadSchema,
  meSettingsSchema,
  type DailyGoalsPayload,
  type MeSettingsPayload,
} from '../../../shared/types/settings'

export const settingsApi = {
  getCurrentUser: () =>
    apiClient.get('/api/me', {
      schema: currentUserSchema,
    }),
  getSettings: () =>
    apiClient.get('/api/me/settings', {
      schema: meSettingsSchema,
    }),
  updateSettings: (payload: MeSettingsPayload) =>
    apiClient.put('/api/me/settings', {
      body: meSettingsPayloadSchema.parse(payload),
      responseType: 'void',
    }),
  getDailyGoals: () =>
    apiClient.get('/api/me/daily-goals', {
      schema: dailyGoalsResponseSchema,
    }),
  updateDailyGoals: (payload: DailyGoalsPayload) =>
    apiClient.put('/api/me/daily-goals', {
      body: dailyGoalsPayloadSchema.parse(payload),
      responseType: 'void',
    }),
}
