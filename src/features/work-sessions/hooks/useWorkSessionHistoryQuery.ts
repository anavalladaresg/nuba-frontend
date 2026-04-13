import { useQuery } from '@tanstack/react-query'
import { useAuthSession } from '../../auth/AuthSessionProvider'
import { workSessionsApi, type HistoryFilters } from '../api/workSessions.api'
import { workSessionKeys } from '../api/workSessions.keys'

export function useWorkSessionHistoryQuery(filters: HistoryFilters, enabled = true) {
  const auth = useAuthSession()

  return useQuery({
    queryKey: workSessionKeys.history(filters),
    queryFn: () => workSessionsApi.getHistory(filters),
    enabled: auth.isAuthenticated && enabled,
    placeholderData: (previousData) => previousData,
  })
}
