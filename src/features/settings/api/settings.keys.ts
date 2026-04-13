export const settingsKeys = {
  all: ['settings'] as const,
  me: () => [...settingsKeys.all, 'me'] as const,
  preferences: () => [...settingsKeys.all, 'preferences'] as const,
  goals: () => [...settingsKeys.all, 'daily-goals'] as const,
}
