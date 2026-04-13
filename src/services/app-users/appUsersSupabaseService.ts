import type { AppUsersDataSource } from './appUsersDataSource'
import { createSupabaseRepository } from '../supabase/create-supabase-repository'

const repository = createSupabaseRepository('app_users')

export const appUsersSupabaseService: AppUsersDataSource = {
  countAll: () => repository.count(),
  async listRecent(limit = 5) {
    const rows = await repository.list<{
      id: string
      email: string
      display_name: string | null
      timezone: string
      created_at: string
    }>({
      columns: 'id, email, display_name, timezone, created_at',
      orderBy: 'created_at',
      limit,
    })

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      timezone: row.timezone,
      createdAt: row.created_at,
    }))
  },
}
