import { apiClient } from '../../../shared/api/api-client'
import {
  notificationsSettingsSchema,
  type NotificationsSettings,
} from '../../../shared/types/settings'

export const notificationsApi = {
  getSettings: () =>
    apiClient.get('/api/notifications/settings', {
      schema: notificationsSettingsSchema,
    }),
  updateSettings: (payload: NotificationsSettings) =>
    apiClient.put('/api/notifications/settings', {
      body: notificationsSettingsSchema.parse(payload),
      responseType: 'void',
    }),
}
