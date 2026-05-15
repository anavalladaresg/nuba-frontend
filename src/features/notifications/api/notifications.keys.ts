export const notificationsKeys = {
  all: ['notifications'] as const,
  settings: () => [...notificationsKeys.all, 'settings'] as const,
  pushSubscriptions: () => [...notificationsKeys.all, 'push-subscriptions'] as const,
}
