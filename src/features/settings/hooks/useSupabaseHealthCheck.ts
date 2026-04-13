import { useQuery } from '@tanstack/react-query'
import { supabaseHealthService } from '../../../services/supabase/supabaseHealth.service'

export const supabaseHealthCheckQueryKey = ['supabase', 'health-check'] as const

export function useSupabaseHealthCheck() {
  return useQuery({
    queryKey: supabaseHealthCheckQueryKey,
    queryFn: () => supabaseHealthService.getReport(),
    staleTime: 60_000,
  })
}
