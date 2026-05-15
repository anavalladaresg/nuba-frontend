import { apiClient } from '../../../shared/api/api-client'
import {
  notificationsSettingsSchema,
  type NotificationsSettings,
} from '../../../shared/types/settings'
import {
  pushSubscriptionDeletePayloadSchema,
  pushSubscriptionPayloadSchema,
  pushSubscriptionsResponseSchema,
  type PushSubscriptionDeletePayload,
  type PushSubscriptionPayload,
} from '../../../shared/types/notifications'

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
  getPushSubscriptions: () =>
    apiClient.get('/api/notifications/push-subscriptions', {
      schema: pushSubscriptionsResponseSchema,
    }),
  savePushSubscription: (payload: PushSubscriptionPayload) =>
    apiClient.put('/api/notifications/push-subscriptions', {
      body: pushSubscriptionPayloadSchema.parse(payload),
      responseType: 'void',
    }),
  deletePushSubscription: (payload: PushSubscriptionDeletePayload) =>
    apiClient.post('/api/notifications/push-subscriptions/unsubscribe', {
      body: pushSubscriptionDeletePayloadSchema.parse(payload),
      responseType: 'void',
    }),
}
