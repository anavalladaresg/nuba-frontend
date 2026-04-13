import type { UserWorkSettingsDataSource } from './userWorkSettingsDataSource'
import { createSupabaseRepository } from '../supabase/create-supabase-repository'

const repository = createSupabaseRepository('user_work_settings')

export const userWorkSettingsSupabaseService: UserWorkSettingsDataSource = {
  countAll: () => repository.count(),
  async listRecent(limit = 5) {
    const rows = await repository.list<{
      id: string
      user_id: string
      same_hours_every_day: boolean
      default_daily_minutes: number | null
      lunch_counts_as_work_time: boolean
      dark_mode_enabled: boolean
    }>({
      columns:
        'id, user_id, same_hours_every_day, default_daily_minutes, lunch_counts_as_work_time, dark_mode_enabled',
      orderBy: 'updated_at',
      limit,
    })

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      sameHoursEveryDay: row.same_hours_every_day,
      defaultDailyMinutes: row.default_daily_minutes,
      lunchCountsAsWorkTime: row.lunch_counts_as_work_time,
      darkModeEnabled: row.dark_mode_enabled,
    }))
  },
}
