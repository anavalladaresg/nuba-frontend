export const statisticsKeys = {
  all: ['statistics'] as const,
  insights: () => [...statisticsKeys.all, 'insights'] as const,
  dashboard: () => [...statisticsKeys.all, 'dashboard'] as const,
}
