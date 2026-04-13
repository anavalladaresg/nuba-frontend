import type { CalendarSpecialDaysDataSource } from './calendarSpecialDaysDataSource'
import { createSupabaseRepository } from '../supabase/create-supabase-repository'

const repository = createSupabaseRepository('calendar_special_days')

export const calendarSpecialDaysSupabaseService: CalendarSpecialDaysDataSource = {
  countAll: () => repository.count(),
  async listRecent(limit = 5) {
    const rows = await repository.list<{
      id: string
      special_date: string
      special_type: string
      name: string
      region_code: string | null
    }>({
      columns: 'id, special_date, special_type, name, region_code',
      orderBy: 'special_date',
      limit,
    })

    return rows.map((row) => ({
      id: row.id,
      specialDate: row.special_date,
      specialType: row.special_type,
      name: row.name,
      regionCode: row.region_code,
    }))
  },
}
