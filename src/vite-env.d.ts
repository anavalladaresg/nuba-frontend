/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_BUSINESS_TIME_ZONE?: string
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string
  readonly VITE_USE_FRONTEND_BACKEND?: string
  readonly VITE_USE_DEV_AUTH?: string
  readonly VITE_ENABLE_VISUAL_EFFECTS?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY?: string
  readonly VITE_USE_SUPABASE_DIRECT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
