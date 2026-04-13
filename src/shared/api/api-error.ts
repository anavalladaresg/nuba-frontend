import type { ApiErrorPayload } from '../types/common'

export class ApiError extends Error {
  status: number
  error: string
  path: string
  fieldErrors: ApiErrorPayload['fieldErrors']
  timestamp?: string

  constructor(payload: ApiErrorPayload) {
    super(payload.message)
    this.name = 'ApiError'
    this.status = payload.status
    this.error = payload.error
    this.path = payload.path
    this.fieldErrors = payload.fieldErrors
    this.timestamp = payload.timestamp
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError
