import { nubaDataSource, nubaDataSourceMode } from '../nubaDataSource'
import { supabaseConfig } from '../../lib/supabase'
import {
  classifySupabaseServiceError,
} from './supabase-service-error'
import type { RecentWorkSessionPreview } from '../work-sessions/workSessionsDataSource'

type ProbeStatus = 'ok' | 'blocked' | 'error'

type HealthProbe = {
  key: string
  label: string
  target: string
  status: ProbeStatus
  message: string
  count: number | null
}

export type SupabaseHealthReport = {
  checkedAt: string
  mode: typeof nubaDataSourceMode
  projectHost: string
  projectReachable: boolean
  connectionStatus: 'ready' | 'degraded' | 'error'
  summary: string
  probes: HealthProbe[]
  recentWorkSessions: RecentWorkSessionPreview[]
}

const runProbe = async (
  key: string,
  label: string,
  target: string,
  countFn: () => Promise<number>,
): Promise<HealthProbe> => {
  try {
    const count = await countFn()

    return {
      key,
      label,
      target,
      status: 'ok',
      message: 'Consulta completada correctamente.',
      count,
    }
  } catch (error) {
    const parsed = classifySupabaseServiceError(error)

    return {
      key,
      label,
      target,
      status: parsed.status,
      message: parsed.message,
      count: null,
    }
  }
}

export const supabaseHealthService = {
  async getReport(): Promise<SupabaseHealthReport> {
    const probes = await Promise.all([
      runProbe(
        'calendarSpecialDays',
        'Calendario especial',
        'public.calendar_special_days',
        nubaDataSource.calendarSpecialDays.countAll,
      ),
      runProbe(
        'workSessions',
        'Sesiones de trabajo',
        'public.work_sessions',
        nubaDataSource.workSessions.countAll,
      ),
      runProbe(
        'appUsers',
        'Usuarios',
        'public.app_users',
        nubaDataSource.appUsers.countAll,
      ),
      runProbe(
        'userWorkSettings',
        'Ajustes de jornada',
        'public.user_work_settings',
        nubaDataSource.userWorkSettings.countAll,
      ),
      runProbe(
        'userDailyGoals',
        'Objetivos diarios',
        'public.user_daily_goals',
        nubaDataSource.userDailyGoals.countAll,
      ),
    ])

    let recentWorkSessions: RecentWorkSessionPreview[] = []

    try {
      recentWorkSessions = await nubaDataSource.workSessions.listRecent(3)
    } catch {
      recentWorkSessions = []
    }

    const okCount = probes.filter((probe) => probe.status === 'ok').length
    const blockedCount = probes.filter((probe) => probe.status === 'blocked').length
    const projectReachable = probes.some(
      (probe) =>
        probe.status === 'ok' ||
        probe.status === 'blocked' ||
        !probe.message.toLowerCase().includes('fetch failed'),
    )
    const hasReachability = okCount > 0 || blockedCount > 0
    const connectionStatus =
      okCount > 0 ? 'ready' : hasReachability ? 'degraded' : 'error'

    const summary =
      connectionStatus === 'ready'
        ? 'Supabase responde y ya tenemos acceso directo al menos a una tabla real de Nuba.'
        : connectionStatus === 'degraded'
          ? 'La conexión con Supabase existe, pero parte del acceso está bloqueado por permisos o RLS.'
          : 'La configuración actual no permite validar el acceso a las tablas del dominio.'

    return {
      checkedAt: new Date().toISOString(),
      mode: nubaDataSourceMode,
      projectHost: supabaseConfig.projectHost,
      projectReachable,
      connectionStatus,
      summary,
      probes,
      recentWorkSessions,
    }
  },
}
