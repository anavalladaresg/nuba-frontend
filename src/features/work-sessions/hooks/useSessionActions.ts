import { useMutation } from '@tanstack/react-query'
import { queryClient } from '../../../shared/api/query-client'
import type { BreakType } from '../../../shared/types/work-session'
import { calendarKeys } from '../../calendar/api/calendar.keys'
import { statisticsKeys } from '../../dashboard/api/statistics.keys'
import { notificationsKeys } from '../../notifications/api/notifications.keys'
import { workSessionsApi } from '../api/workSessions.api'
import { workSessionKeys } from '../api/workSessions.keys'

async function invalidateSessionRelatedQueries() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: workSessionKeys.all }),
    queryClient.invalidateQueries({ queryKey: statisticsKeys.all }),
    queryClient.invalidateQueries({ queryKey: calendarKeys.all }),
    queryClient.invalidateQueries({ queryKey: notificationsKeys.all }),
  ])
}

export function useSessionActions() {
  const startMutation = useMutation({
    mutationFn: workSessionsApi.start,
    onSuccess: invalidateSessionRelatedQueries,
  })

  const pauseMutation = useMutation({
    mutationFn: (breakType: BreakType) => workSessionsApi.pause(breakType),
    onSuccess: invalidateSessionRelatedQueries,
  })

  const registerOutingMutation = useMutation({
    mutationFn: workSessionsApi.registerOuting,
    onSuccess: invalidateSessionRelatedQueries,
  })

  const resumeMutation = useMutation({
    mutationFn: workSessionsApi.resume,
    onSuccess: invalidateSessionRelatedQueries,
  })

  const stopMutation = useMutation({
    mutationFn: workSessionsApi.stop,
    onSuccess: invalidateSessionRelatedQueries,
  })

  return {
    startMutation,
    pauseMutation,
    registerOutingMutation,
    resumeMutation,
    stopMutation,
    hasPendingAction:
      startMutation.isPending ||
      pauseMutation.isPending ||
      registerOutingMutation.isPending ||
      resumeMutation.isPending ||
      stopMutation.isPending,
  }
}
