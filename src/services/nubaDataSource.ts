import { appUsersSupabaseService } from './app-users/appUsersSupabaseService'
import { calendarSpecialDaysSupabaseService } from './calendar/calendarSpecialDaysSupabaseService'
import { userDailyGoalsSupabaseService } from './settings/userDailyGoalsSupabaseService'
import { userWorkSettingsSupabaseService } from './settings/userWorkSettingsSupabaseService'
import { workSessionsSupabaseService } from './work-sessions/workSessionsSupabaseService'

export const nubaDataSourceMode = 'supabase-direct' as const

export const nubaDataSource = {
  appUsers: appUsersSupabaseService,
  calendarSpecialDays: calendarSpecialDaysSupabaseService,
  userDailyGoals: userDailyGoalsSupabaseService,
  userWorkSettings: userWorkSettingsSupabaseService,
  workSessions: workSessionsSupabaseService,
}
