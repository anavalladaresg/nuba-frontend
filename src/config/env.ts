const normalizeOptionalString = (value: string | undefined) => value?.trim() || ''

const supabaseUrl = normalizeOptionalString(import.meta.env.VITE_SUPABASE_URL)
const supabasePublishableKey = normalizeOptionalString(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
)
const webPushPublicKey = normalizeOptionalString(import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY)
const hasSupabaseConfig = Boolean(supabaseUrl && supabasePublishableKey)

export const env = {
  apiBaseUrl: normalizeOptionalString(import.meta.env.VITE_API_BASE_URL),
  businessTimeZone:
    normalizeOptionalString(import.meta.env.VITE_BUSINESS_TIME_ZONE) || 'Europe/Madrid',
  clerkPublishableKey: normalizeOptionalString(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY),
  supabaseUrl,
  supabasePublishableKey,
  webPushPublicKey,
  useSupabaseDirect:
    hasSupabaseConfig &&
    normalizeOptionalString(import.meta.env.VITE_USE_SUPABASE_DIRECT) !== 'false',
  useFrontendBackend:
    normalizeOptionalString(import.meta.env.VITE_USE_FRONTEND_BACKEND) !== 'false',
  useDevAuthToken:
    import.meta.env.DEV && normalizeOptionalString(import.meta.env.VITE_USE_DEV_AUTH) !== 'false',
  visualEffectsEnabled:
    normalizeOptionalString(import.meta.env.VITE_ENABLE_VISUAL_EFFECTS) !== 'false',
} as const

export const hasClerk = Boolean(env.clerkPublishableKey)
export const hasSupabase = hasSupabaseConfig
