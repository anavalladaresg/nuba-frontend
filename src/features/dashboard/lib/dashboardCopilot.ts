import type { DashboardStatisticsResponse, DashboardWorkPattern } from '../../../shared/types/statistics'

export type Tone = 'brand' | 'success' | 'warning' | 'violet' | 'neutral'

export type DashboardCopilotModel = {
  isEmpty: boolean
  hero: {
    title: string
    body: string
    badge: string
    tone: Tone
    metric?: {
      label: string
      value: string
      tone: Tone
    }
  }
  habits: {
    items: Array<{
      label: string
      value: string
      tone: Tone
    }>
  }
  trend?: {
    title: string
    highlight: string
    bars: Array<{
      label: string
      value: number
      isCurrent: boolean
      tone: Tone
    }>
    interpretation: string
  }
  consistency?: {
    score: number
    interpretation: string
  }
}

function formatMinuteOfDay(minuteOfDay: number): string {
  const hour = Math.floor(minuteOfDay / 60)
  const minute = minuteOfDay % 60
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function generateHeroInsight(pattern: DashboardWorkPattern): {
  title: string
  body: string
  metric?: { label: string; value: string; tone: Tone }
  badge: string
  tone: Tone
} {
  const { averageStartMinuteOfDay, averageCompletionRate, sampledDays } = pattern

  // If insufficient data, show a simple, elegant empty state
  if (sampledDays < 3 || averageStartMinuteOfDay === null) {
    return {
      title: 'Aún estamos observando tu ritmo',
      body: 'Necesitamos unos días más para entender mejor tus patrones de entrada y salida.',
      badge: 'Pronto',
      tone: 'neutral',
    }
  }

  // Primary insight: entry concentration
  const entryTime = formatMinuteOfDay(averageStartMinuteOfDay)
  const title = `Entradas alrededor de las ${entryTime}`
  const body =
    averageCompletionRate && averageCompletionRate >= 92
      ? 'Tu entrada es consistente y tu jornada tiende a completarse. Un patrón sólido.'
      : 'Detectamos una concentración clara en tu hora de entrada durante estos días.'

  const completionMetric =
    averageCompletionRate !== null && averageCompletionRate >= 85
      ? { label: 'Completitud', value: `${Math.round(averageCompletionRate)}%`, tone: 'success' as const }
      : undefined

  return {
    title,
    body,
    metric: completionMetric,
    badge: 'Observado',
    tone: sampledDays >= 7 ? 'brand' : 'neutral',
  }
}

function generateHabitsSection(pattern: DashboardWorkPattern): Array<{
  label: string
  value: string
  tone: Tone
}> {
  const items: Array<{
    label: string
    value: string
    tone: Tone
  }> = []

  if (pattern.averageStartMinuteOfDay !== null) {
    items.push({
      label: 'Entrada media',
      value: formatMinuteOfDay(pattern.averageStartMinuteOfDay),
      tone: 'brand',
    })
  }

  if (pattern.averageWorkedMinutes > 0) {
    items.push({
      label: 'Promedio diario',
      value: formatMinutes(pattern.averageWorkedMinutes),
      tone: 'success',
    })
  }

  if (pattern.averageBreakMinutes > 0) {
    items.push({
      label: 'Pausa habitual',
      value: `${pattern.averageBreakMinutes}m`,
      tone: 'warning',
    })
  }

  return items
}

function generateTrendBar(
  weekDays: DashboardStatisticsResponse['currentWeekDays'],
  recentDays: DashboardStatisticsResponse['recentDays'],
) {
  if (weekDays.length === 0) return undefined

  // Use current week data only
  const dayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
  const bars = weekDays.map((day, index) => {
    const isToday = index === weekDays.length - 1
    const completionRate = day.completionRate ?? 0
    const dayOfWeek = new Date(day.date).getDay()
    const label = dayLabels[dayOfWeek === 0 ? 6 : dayOfWeek - 1] || 'D'

    return {
      label,
      value: completionRate,
      isCurrent: isToday,
      tone: (
        completionRate >= 95 ? 'success' : completionRate >= 80 ? 'brand' : 'neutral'
      ) as Tone,
    }
  })

  const avgCompletion =
    weekDays.reduce((sum, d) => sum + (d.completionRate ?? 0), 0) / weekDays.length
  const interpretation = `Esta semana promedias ${Math.round(avgCompletion)}% de completitud.`

  return {
    title: 'Tendencia semanal',
    highlight: `${Math.round(avgCompletion)}% en promedio`,
    bars,
    interpretation,
  }
}

function generateConsistency(
  pattern: DashboardWorkPattern,
  weekDays: DashboardStatisticsResponse['currentWeekDays'],
): { score: number; interpretation: string } | undefined {
  if (pattern.sampledDays < 5) return undefined

  // Calculate consistency: how stable is the completion rate
  const completionRates = weekDays.map((d) => d.completionRate ?? 0)
  const avgCompletion = completionRates.reduce((a, b) => a + b) / completionRates.length
  const variance = completionRates.reduce((sum, rate) => sum + Math.pow(rate - avgCompletion, 2), 0) / completionRates.length
  const stdDev = Math.sqrt(variance)

  // Convert std dev to 0-100 score (lower variability = higher score)
  const consistencyScore = Math.max(0, Math.min(100, 100 - stdDev))

  const interpretation =
    consistencyScore >= 85
      ? 'Tus jornadas son muy predecibles. Esto facilita la planificación.'
      : consistencyScore >= 70
        ? 'Tienes días más sólidos que otros, pero es un patrón natural.'
        : 'Hay variabilidad en cómo cierras cada jornada.'

  return { score: Math.round(consistencyScore), interpretation }
}

export function buildDashboardCopilotModel({
  dashboard,
}: {
  dashboard: DashboardStatisticsResponse
}): DashboardCopilotModel {
  const { recentPattern, currentWeekDays } = dashboard
  const hasMinimalData = recentPattern.sampledDays < 1

  if (hasMinimalData) {
    return {
      isEmpty: true,
      hero: {
        title: 'Bienvenido a Insights',
        body: 'Una vez que registres algunas jornadas, comenzaremos a mostrar tus patrones de trabajo y hábitos.',
        badge: 'Nuevo',
        tone: 'neutral',
      },
      habits: {
        items: [],
      },
    }
  }

  const hero = generateHeroInsight(recentPattern)
  const habitsItems = generateHabitsSection(recentPattern)
  const trend = generateTrendBar(currentWeekDays, dashboard.recentDays)
  const consistency = generateConsistency(recentPattern, currentWeekDays)

  return {
    isEmpty: false,
    hero: {
      title: hero.title,
      body: hero.body,
      badge: hero.badge,
      tone: hero.tone,
      metric: hero.metric,
    },
    habits: {
      items: habitsItems,
    },
    trend,
    consistency,
  }
}
