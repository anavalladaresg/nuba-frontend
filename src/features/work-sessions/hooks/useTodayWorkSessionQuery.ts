import { useQuery } from '@tanstack/react-query'
import { useAuthSession } from '../../auth/AuthSessionProvider'
import { workSessionsApi } from '../api/workSessions.api'
import { workSessionKeys } from '../api/workSessions.keys'

export function useTodayWorkSessionQuery() {
  const auth = useAuthSession()

  return useQuery({
    queryKey: workSessionKeys.today(),
    queryFn: workSessionsApi.getToday,
    enabled: auth.isAuthenticated,
    refetchInterval: (query) =>
      query.state.data?.summary.hasOpenSession ? 60_000 : false,
  })
}
