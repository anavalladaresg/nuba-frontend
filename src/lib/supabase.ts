import { createClient } from '@supabase/supabase-js'
import type { Database } from './supabase-database.types'

const getRequiredSupabaseEnv = (key: keyof ImportMetaEnv) => {
  const value = import.meta.env[key]?.trim()

  if (!value) {
    throw new Error(
      `[Supabase] Falta la variable ${key}. Añádela en .env antes de iniciar la app.`,
    )
  }

  return value
}

const assertValidSupabaseUrl = (value: string) => {
  try {
    return new URL(value).toString()
  } catch {
    throw new Error(
      '[Supabase] VITE_SUPABASE_URL no es una URL válida. Revisa la configuración del proyecto.',
    )
  }
}

const assertValidPublishableKey = (value: string) => {
  if (!value.startsWith('sb_publishable_')) {
    throw new Error(
      '[Supabase] VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY no tiene formato de publishable key.',
    )
  }

  return value
}

const supabaseUrl = assertValidSupabaseUrl(getRequiredSupabaseEnv('VITE_SUPABASE_URL'))
const supabasePublishableKey = assertValidPublishableKey(
  getRequiredSupabaseEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY'),
)

export const supabaseConfig = {
  projectUrl: supabaseUrl,
  projectHost: new URL(supabaseUrl).host,
} as const

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'X-Client-Info': 'nuba-frontend/supabase-direct',
    },
  },
})
