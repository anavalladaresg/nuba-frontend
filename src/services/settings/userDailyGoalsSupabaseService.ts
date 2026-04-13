import type { UserDailyGoalsDataSource } from './userDailyGoalsDataSource'
import { createSupabaseRepository } from '../supabase/create-supabase-repository'

const repository = createSupabaseRepository('user_daily_goals')

export const userDailyGoalsSupabaseService: UserDailyGoalsDataSource = {
  countAll: () => repository.count(),
  async listRecent(limit = 7) {
    const rows = await repository.list<{
      id: string
      user_id: string
      day_of_week: number
      target_minutes: number
    }>({
      columns: 'id, user_id, day_of_week, target_minutes',
      orderBy: 'created_at',
      limit,
    })

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      dayOfWeek: row.day_of_week,
      targetMinutes: row.target_minutes,
    }))
  },
}
