export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      app_users: {
        Row: {
          id: string
          clerk_user_id: string
          email: string
          display_name: string | null
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clerk_user_id: string
          email: string
          display_name?: string | null
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clerk_user_id?: string
          email?: string
          display_name?: string | null
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      break_sessions: {
        Row: {
          id: string
          work_session_id: string
          break_type: string
          start_time: string
          end_time: string | null
          duration_minutes: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          work_session_id: string
          break_type?: string
          start_time: string
          end_time?: string | null
          duration_minutes?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          work_session_id?: string
          break_type?: string
          start_time?: string
          end_time?: string | null
          duration_minutes?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'break_sessions_work_session_id_fkey'
            columns: ['work_session_id']
            referencedRelation: 'work_sessions'
            referencedColumns: ['id']
          },
        ]
      }
      calendar_special_days: {
        Row: {
          id: string
          special_date: string
          special_type: string
          name: string
          region_code: string | null
          created_at: string
        }
        Insert: {
          id?: string
          special_date: string
          special_type: string
          name: string
          region_code?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          special_date?: string
          special_type?: string
          name?: string
          region_code?: string | null
          created_at?: string
        }
        Relationships: []
      }
      manual_edit_logs: {
        Row: {
          id: string
          work_session_id: string
          user_id: string
          field_changed: string
          old_value: string | null
          new_value: string | null
          reason: string | null
          edited_at: string
        }
        Insert: {
          id?: string
          work_session_id: string
          user_id: string
          field_changed: string
          old_value?: string | null
          new_value?: string | null
          reason?: string | null
          edited_at?: string
        }
        Update: {
          id?: string
          work_session_id?: string
          user_id?: string
          field_changed?: string
          old_value?: string | null
          new_value?: string | null
          reason?: string | null
          edited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'manual_edit_logs_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'manual_edit_logs_work_session_id_fkey'
            columns: ['work_session_id']
            referencedRelation: 'work_sessions'
            referencedColumns: ['id']
          },
        ]
      }
      notification_settings: {
        Row: {
          id: string
          user_id: string
          smart_reminders_enabled: boolean
          remind_start: boolean
          remind_pause: boolean
          remind_stop: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          smart_reminders_enabled?: boolean
          remind_start?: boolean
          remind_pause?: boolean
          remind_stop?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          smart_reminders_enabled?: boolean
          remind_start?: boolean
          remind_pause?: boolean
          remind_stop?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notification_settings_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
        ]
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh_key: string
          auth_key: string
          platform: string | null
          user_agent: string | null
          created_at: string
          updated_at: string
          last_seen_at: string
          last_success_at: string | null
          last_failure_at: string | null
          failure_count: number
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh_key: string
          auth_key: string
          platform?: string | null
          user_agent?: string | null
          created_at?: string
          updated_at?: string
          last_seen_at?: string
          last_success_at?: string | null
          last_failure_at?: string | null
          failure_count?: number
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          p256dh_key?: string
          auth_key?: string
          platform?: string | null
          user_agent?: string | null
          created_at?: string
          updated_at?: string
          last_seen_at?: string
          last_success_at?: string | null
          last_failure_at?: string | null
          failure_count?: number
        }
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
        ]
      }
      notification_delivery_logs: {
        Row: {
          id: string
          user_id: string
          work_session_id: string | null
          push_subscription_id: string | null
          reminder_type: string
          dedupe_key: string
          delivered: boolean
          payload: unknown
          sent_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          work_session_id?: string | null
          push_subscription_id?: string | null
          reminder_type: string
          dedupe_key: string
          delivered?: boolean
          payload?: unknown
          sent_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          work_session_id?: string | null
          push_subscription_id?: string | null
          reminder_type?: string
          dedupe_key?: string
          delivered?: boolean
          payload?: unknown
          sent_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notification_delivery_logs_push_subscription_id_fkey'
            columns: ['push_subscription_id']
            referencedRelation: 'push_subscriptions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notification_delivery_logs_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notification_delivery_logs_work_session_id_fkey'
            columns: ['work_session_id']
            referencedRelation: 'work_sessions'
            referencedColumns: ['id']
          },
        ]
      }
      user_daily_goals: {
        Row: {
          id: string
          user_id: string
          day_of_week: number
          target_minutes: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          day_of_week: number
          target_minutes?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          day_of_week?: number
          target_minutes?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_daily_goals_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
        ]
      }
      user_work_settings: {
        Row: {
          id: string
          user_id: string
          same_hours_every_day: boolean
          default_daily_minutes: number | null
          lunch_counts_as_work_time: boolean
          dark_mode_enabled: boolean
          auto_complete_forgotten_checkout: boolean
          auto_complete_grace_minutes: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          same_hours_every_day?: boolean
          default_daily_minutes?: number | null
          lunch_counts_as_work_time?: boolean
          dark_mode_enabled?: boolean
          auto_complete_forgotten_checkout?: boolean
          auto_complete_grace_minutes?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          same_hours_every_day?: boolean
          default_daily_minutes?: number | null
          lunch_counts_as_work_time?: boolean
          dark_mode_enabled?: boolean
          auto_complete_forgotten_checkout?: boolean
          auto_complete_grace_minutes?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_work_settings_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
        ]
      }
      work_sessions: {
        Row: {
          id: string
          user_id: string
          work_date: string
          start_time: string
          end_time: string | null
          status: string
          goal_minutes: number
          worked_minutes: number
          break_minutes: number
          extra_minutes: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          work_date: string
          start_time: string
          end_time?: string | null
          status: string
          goal_minutes?: number
          worked_minutes?: number
          break_minutes?: number
          extra_minutes?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          work_date?: string
          start_time?: string
          end_time?: string | null
          status?: string
          goal_minutes?: number
          worked_minutes?: number
          break_minutes?: number
          extra_minutes?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'work_sessions_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type NubaPublicTableName = keyof Database['public']['Tables']

export type NubaTableRow<TTable extends NubaPublicTableName> =
  Database['public']['Tables'][TTable]['Row']

export type NubaTableInsert<TTable extends NubaPublicTableName> =
  Database['public']['Tables'][TTable]['Insert']

export type NubaTableUpdate<TTable extends NubaPublicTableName> =
  Database['public']['Tables'][TTable]['Update']
