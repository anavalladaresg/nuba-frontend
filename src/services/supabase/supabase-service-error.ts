import type { AuthError, PostgrestError } from '@supabase/supabase-js'

type SupabaseErrorLike =
  | AuthError
  | PostgrestError
  | Error
  | {
      message?: string
      code?: string
      details?: string
      hint?: string
    }
  | null
  | undefined

export class SupabaseServiceError extends Error {
  readonly code: string | null
  readonly details: string | null
  readonly hint: string | null

  constructor(
    message: string,
    options: {
      code?: string | null
      details?: string | null
      hint?: string | null
    } = {},
  ) {
    super(message)
    this.name = 'SupabaseServiceError'
    this.code = options.code ?? null
    this.details = options.details ?? null
    this.hint = options.hint ?? null
  }
}

export const toSupabaseServiceError = (
  error: SupabaseErrorLike,
  fallbackMessage: string,
) => {
  if (!error) {
    return new SupabaseServiceError(fallbackMessage)
  }

  const code = 'code' in error && typeof error.code === 'string' ? error.code : null
  const details =
    'details' in error && typeof error.details === 'string' ? error.details : null
  const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : null
  const message = 'message' in error && typeof error.message === 'string'
    ? error.message
    : fallbackMessage

  return new SupabaseServiceError(message, {
    code,
    details,
    hint,
  })
}

export const classifySupabaseServiceError = (error: unknown) => {
  if (!(error instanceof SupabaseServiceError)) {
    return {
      status: 'error' as const,
      message: error instanceof Error ? error.message : 'Error desconocido de Supabase.',
    }
  }

  const diagnostic = `${error.message} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
  const blocked =
    error.code === '42501' ||
    diagnostic.includes('row-level security') ||
    diagnostic.includes('permission denied') ||
    diagnostic.includes('not allowed')

  return {
    status: blocked ? ('blocked' as const) : ('error' as const),
    message: error.message,
  }
}
