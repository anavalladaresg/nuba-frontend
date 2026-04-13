import type { ZodSchema } from 'zod'
import { env } from '../../config/env'
import { getAccessToken } from './auth-resolver'
import type { QueryParams } from '../types/common'
import { apiErrorSchema } from '../types/common'
import { ApiError } from './api-error'
import { prototypeBackendRequest } from '../prototype/prototype-backend'

type ResponseType = 'json' | 'blob' | 'text' | 'void'

type RequestOptions<TSchema> = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: QueryParams
  body?: unknown
  headers?: HeadersInit
  responseType?: ResponseType
  schema?: ZodSchema<TSchema>
  signal?: AbortSignal
  auth?: boolean
}

const buildUrl = (path: string, query?: QueryParams) => {
  const url = new URL(path, env.apiBaseUrl || window.location.origin)

  if (!query) {
    return url.toString()
  }

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    url.searchParams.set(key, String(value))
  })

  return url.toString()
}

const parseBody = async <TSchema>(
  response: Response,
  responseType: ResponseType,
  schema?: ZodSchema<TSchema>,
) => {
  if (responseType === 'void' || response.status === 204) {
    return undefined as TSchema
  }

  if (responseType === 'blob') {
    return (await response.blob()) as TSchema
  }

  if (responseType === 'text') {
    return (await response.text()) as TSchema
  }

  const payload = await response.json()
  return schema ? schema.parse(payload) : (payload as TSchema)
}

const toApiError = async (response: Response) => {
  try {
    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      const payload = apiErrorSchema.parse(await response.json())
      return new ApiError(payload)
    }
  } catch {
    // Ignore malformed payloads and fallback to generic error below.
  }

  return new ApiError({
    status: response.status,
    error: response.statusText || 'Request Error',
    message: 'No se pudo completar la solicitud.',
    path: response.url,
    fieldErrors: [],
  })
}

async function request<TSchema>(
  path: string,
  options: RequestOptions<TSchema> = {},
) {
  const {
    method = 'GET',
    query,
    body,
    headers,
    responseType = 'json',
    schema,
    signal,
    auth = true,
  } = options

  const nextHeaders = new Headers(headers)

  if (!nextHeaders.has('Accept') && responseType === 'json') {
    nextHeaders.set('Accept', 'application/json')
  }

  if (body && !(body instanceof FormData)) {
    nextHeaders.set('Content-Type', 'application/json')
  }

  if (auth) {
    const token = await getAccessToken()
    if (token) {
      nextHeaders.set('Authorization', `Bearer ${token}`)
    }
  }

  if (env.useSupabaseDirect && path.startsWith('/api/')) {
    const { supabaseFrontendRequest } = await import('./supabase-frontend-backend')
    const payload = await supabaseFrontendRequest<TSchema>(path, {
      method,
      query,
      body,
      signal,
    })

    return schema ? schema.parse(payload) : payload
  }

  if (env.useFrontendBackend && path.startsWith('/api/')) {
    const payload = await prototypeBackendRequest<TSchema>(path, {
      method,
      query,
      body,
      signal,
    })

    return schema ? schema.parse(payload) : payload
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers: nextHeaders,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal,
  })

  if (!response.ok) {
    throw await toApiError(response)
  }

  return parseBody(response, responseType, schema)
}

export const apiClient = {
  get: <TSchema>(path: string, options?: Omit<RequestOptions<TSchema>, 'method'>) =>
    request(path, { ...options, method: 'GET' }),
  post: <TSchema>(path: string, options?: Omit<RequestOptions<TSchema>, 'method'>) =>
    request(path, { ...options, method: 'POST' }),
  put: <TSchema>(path: string, options?: Omit<RequestOptions<TSchema>, 'method'>) =>
    request(path, { ...options, method: 'PUT' }),
}
