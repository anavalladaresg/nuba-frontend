import { useQuery } from '@tanstack/react-query'
import { useAuthSession } from '../../auth/AuthSessionProvider'
import { workSessionsApi } from '../api/workSessions.api'
import { workSessionKeys } from '../api/workSessions.keys'

export function useWorkSessionDetailQuery(sessionId: string | null) {
  const auth = useAuthSession()

  return useQuery({
    queryKey: workSessionKeys.detail(sessionId ?? 'unknown'),
    queryFn: () => workSessionsApi.getDetail(sessionId ?? ''),
    enabled: auth.isAuthenticated && Boolean(sessionId),
  })
}
