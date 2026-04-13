import { apiClient } from '../../../shared/api/api-client'
import { dashboardStatisticsResponseSchema } from '../../../shared/types/statistics'

export const statisticsApi = {
  getInsights: () =>
    apiClient.get('/api/statistics/dashboard', {
      schema: dashboardStatisticsResponseSchema,
    }),
  getDashboard: () =>
    apiClient.get('/api/statistics/dashboard', {
      schema: dashboardStatisticsResponseSchema,
    }),
}
