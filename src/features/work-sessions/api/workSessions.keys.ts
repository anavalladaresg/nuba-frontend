export const workSessionKeys = {
  all: ['work-sessions'] as const,
  today: () => [...workSessionKeys.all, 'today'] as const,
  history: (filters: Record<string, unknown>) =>
    [...workSessionKeys.all, 'history', filters] as const,
  detail: (sessionId: string) => [...workSessionKeys.all, 'detail', sessionId] as const,
}
