import { useQuery } from '@tanstack/react-query'
import { statisticsApi } from '../api/statistics.api'
import { statisticsKeys } from '../api/statistics.keys'
import {
  DashboardConsistencyCard,
  DashboardHabitsCard,
  DashboardHeroCard,
  DashboardTrendCard,
} from '../components/DashboardCopilotSections'
import { buildDashboardCopilotModel } from '../lib/dashboardCopilot'
import { useAuthSession } from '../../auth/AuthSessionProvider'
import { ErrorState, LoadingState } from '../../../shared/ui/states/StateViews'
import { isApiError } from '../../../shared/api/api-error'

export function InsightsScreen() {
  const auth = useAuthSession()
  const insightsQuery = useQuery({
    queryKey: statisticsKeys.insights(),
    queryFn: statisticsApi.getInsights,
    enabled: auth.isAuthenticated,
  })

  if (insightsQuery.isLoading && !insightsQuery.data) {
    return (
      <LoadingState
        title="Cargando insights"
        description="Analizando patrones de entrada, ritmo semanal y hábitos de jornada."
      />
    )
  }

  if (insightsQuery.isError && !insightsQuery.data) {
    return (
      <ErrorState
        title="No pudimos cargar Insights"
        description={
          isApiError(insightsQuery.error)
            ? insightsQuery.error.message
            : 'Vuelve a intentarlo para reconstruir tus patrones recientes.'
        }
        onRetry={() => void insightsQuery.refetch()}
      />
    )
  }

  if (!insightsQuery.data) {
    return null
  }

  const insights = buildDashboardCopilotModel({
    dashboard: insightsQuery.data,
  })

  return (
    <div className="relative space-y-3 overflow-hidden pb-2">
      <div className="pointer-events-none absolute inset-x-[-18%] top-0 h-44 bg-[radial-gradient(circle,_rgb(124_158_255_/_0.08),_transparent_62%)] blur-[76px]" />
      <div className="pointer-events-none absolute right-[-18%] top-[26rem] h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgb(179_136_255_/_0.08),_transparent_62%)] blur-[110px]" />

      <div className="relative space-y-3">
        <DashboardHeroCard hero={insights.hero} />
        <DashboardHabitsCard habits={insights.habits} />
        <DashboardTrendCard trend={insights.trend} />
        <DashboardConsistencyCard consistency={insights.consistency} />
      </div>
    </div>
  )
}
