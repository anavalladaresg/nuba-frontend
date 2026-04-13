import type { WorkSessionsDataSource } from './workSessionsDataSource'
import { createSupabaseRepository } from '../supabase/create-supabase-repository'

const repository = createSupabaseRepository('work_sessions')

export const workSessionsSupabaseService: WorkSessionsDataSource = {
  countAll: () => repository.count(),
  async listRecent(limit = 3) {
    const rows = await repository.list<{
      id: string
      work_date: string
      status: string
      start_time: string
      end_time: string | null
      worked_minutes: number
      break_minutes: number
      extra_minutes: number
    }>({
      columns:
        'id, work_date, status, start_time, end_time, worked_minutes, break_minutes, extra_minutes',
      orderBy: 'work_date',
      limit,
    })

    return rows.map((row) => ({
      id: row.id,
      workDate: row.work_date,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      workedMinutes: row.worked_minutes,
      breakMinutes: row.break_minutes,
      extraMinutes: row.extra_minutes,
    }))
  },
}
