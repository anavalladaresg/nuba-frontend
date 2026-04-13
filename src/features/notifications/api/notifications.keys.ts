export const notificationsKeys = {
  all: ['notifications'] as const,
  settings: () => [...notificationsKeys.all, 'settings'] as const,
}
