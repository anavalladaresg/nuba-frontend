import { apiClient } from '../../../shared/api/api-client'
import { calendarMonthResponseSchema } from '../../../shared/types/statistics'

export const calendarApi = {
  getMonth: (year: number, month: number) =>
    apiClient.get('/api/calendar/month', {
      query: { year, month },
      schema: calendarMonthResponseSchema,
    }),
}
