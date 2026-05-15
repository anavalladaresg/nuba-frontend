import { apiClient } from '../../../shared/api/api-client'
import {
  todayWorkSessionsResponseSchema,
  workSessionDetailResponseSchema,
  workSessionHistoryResponseSchema,
  workSessionPausePayloadSchema,
  workSessionStartResponseSchema,
  workSessionUpdatePayloadSchema,
  type BreakType,
  type WorkSessionDetailResponse,
  type WorkSessionHistoryResponse,
  type WorkSessionUpdatePayload,
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
      schema: workSessionStartResponseSchema,
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
  getDetail: (sessionId: string) =>
    apiClient.get<WorkSessionDetailResponse>(`/api/work-sessions/${sessionId}`, {
      schema: workSessionDetailResponseSchema,
    }),
  update: (sessionId: string, payload: WorkSessionUpdatePayload) =>
    apiClient.put(`/api/work-sessions/${sessionId}`, {
      body: workSessionUpdatePayloadSchema.parse(payload),
      responseType: 'void',
    }),
}

export type { HistoryFilters }
