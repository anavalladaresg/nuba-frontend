import { apiClient } from '../../../shared/api/api-client'
import {
  todayWorkSessionsResponseSchema,
  workSessionHistoryResponseSchema,
  workSessionPausePayloadSchema,
  type BreakType,
  type WorkSessionHistoryResponse,
} from '../../../shared/types/work-session'

type HistoryFilters = {
  from?: string
  to?: string
  page?: number
  size?: number
}

export const workSessionsApi = {
  getToday: () =>
    apiClient.get('/api/work-sessions/today', {
      schema: todayWorkSessionsResponseSchema,
    }),
  start: () =>
    apiClient.post('/api/work-sessions/start', {
      responseType: 'void',
    }),
  pause: (breakType: BreakType) =>
    apiClient.post('/api/work-sessions/pause', {
      body: workSessionPausePayloadSchema.parse({ breakType }),
      responseType: 'void',
    }),
  registerOuting: () =>
    apiClient.post('/api/work-sessions/outings', {
      responseType: 'void',
    }),
  resume: () =>
    apiClient.post('/api/work-sessions/resume', {
      responseType: 'void',
    }),
  stop: () =>
    apiClient.post('/api/work-sessions/stop', {
      responseType: 'void',
    }),
  getHistory: (filters: HistoryFilters) =>
    apiClient.get<WorkSessionHistoryResponse>('/api/work-sessions/history', {
      query: filters,
      schema: workSessionHistoryResponseSchema,
    }),
}

export type { HistoryFilters }
