import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import webpush from 'npm:web-push@3.6.7'

type AppUserRow = {
  id: string
  email: string
  display_name: string | null
  timezone: string
}

type NotificationSettingsRow = {
  user_id: string
  smart_reminders_enabled: boolean
  remind_start: boolean
  remind_pause: boolean
  remind_stop: boolean
}

type UserWorkSettingsRow = {
  user_id: string
  same_hours_every_day: boolean
  default_daily_minutes: number | null
  lunch_counts_as_work_time: boolean
}

type UserDailyGoalRow = {
  user_id: string
  day_of_week: number
  target_minutes: number
}

type WorkSessionRow = {
  id: string
  user_id: string
  work_date: string
  start_time: string
  end_time: string | null
  status: string
  goal_minutes: number
}

type BreakSessionRow = {
  id: string
  work_session_id: string
  break_type: string
  start_time: string
  end_time: string | null
  duration_minutes: number
}

type PushSubscriptionRow = {
  id: string
  user_id: string
  endpoint: string
  p256dh_key: string
  auth_key: string
  platform: string | null
  user_agent: string | null
  failure_count: number
}

type NotificationDeliveryLogRow = {
  push_subscription_id: string | null
  dedupe_key: string
}

type SpecialDayRow = {
  special_date: string
}

type UserReminder = {
  userId: string
  workSessionId: string | null
  reminderType: 'START' | 'PAUSE' | 'STOP' | 'SMART_STOP' | 'TEST'
  dedupeKey: string
  title: string
  body: string
  tag: string
  url: string
  requireInteraction?: boolean
}

type DeliveryCandidate = UserReminder & {
  subscription: PushSubscriptionRow
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-nuba-cron-secret',
}

const STOP_GRACE_MINUTES = 10
const STOP_REPEAT_INTERVAL_MINUTES = 60
const PAUSE_REMINDER_MINUTES = 45
const START_REMINDER_MINUTE_OF_DAY = 9 * 60 + 30

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)?.trim()

  if (!value) {
    throw new Error(`Missing environment variable ${name}`)
  }

  return value
}

const supabaseUrl = requiredEnv('SUPABASE_URL')
const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
const vapidSubject = requiredEnv('WEB_PUSH_VAPID_SUBJECT')
const vapidPublicKey = requiredEnv('WEB_PUSH_VAPID_PUBLIC_KEY')
const vapidPrivateKey = requiredEnv('WEB_PUSH_VAPID_PRIVATE_KEY')
const cronSecret = requiredEnv('NUBA_CRON_SECRET')

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })

const minutesBetween = (startIso: string, endIso: string) =>
  Math.max(0, Math.floor((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000))

const groupBy = <T, TKey extends string>(
  items: T[],
  getKey: (item: T) => TKey,
) =>
  items.reduce<Record<TKey, T[]>>((accumulator, item) => {
    const key = getKey(item)
    accumulator[key] ??= []
    accumulator[key].push(item)
    return accumulator
  }, {} as Record<TKey, T[]>)

const getLocalParts = (value: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(value)
  const byType = new Map(parts.map((part) => [part.type, part.value]))
  const year = byType.get('year') ?? '1970'
  const month = byType.get('month') ?? '01'
  const day = byType.get('day') ?? '01'
  const hour = Number(byType.get('hour') ?? '0')
  const minute = Number(byType.get('minute') ?? '0')

  return {
    localDate: `${year}-${month}-${day}`,
    minuteOfDay: hour * 60 + minute,
  }
}

const getDayOfWeek = (localDate: string) => {
  const day = new Date(`${localDate}T12:00:00Z`).getUTCDay()
  return ((day + 6) % 7) + 1
}

const isWeekendDate = (localDate: string) => {
  const dayOfWeek = getDayOfWeek(localDate)
  return dayOfWeek === 6 || dayOfWeek === 7
}

const getUniformWeekdayTargetMinutes = (
  goals: UserDailyGoalRow[],
  workSettings: UserWorkSettingsRow | null,
) => {
  if (
    typeof workSettings?.default_daily_minutes === 'number' &&
    Number.isFinite(workSettings.default_daily_minutes)
  ) {
    return Math.max(0, Math.trunc(workSettings.default_daily_minutes))
  }

  const weekdayTargets = goals
    .filter((goal) => goal.day_of_week >= 1 && goal.day_of_week <= 5)
    .map((goal) => goal.target_minutes)
    .filter((value) => value > 0)

  return weekdayTargets[0] ?? 0
}

const getTargetMinutesForDate = ({
  goals,
  localDate,
  specialDays,
  workSettings,
}: {
  goals: UserDailyGoalRow[]
  localDate: string
  specialDays: Set<string>
  workSettings: UserWorkSettingsRow | null
}) => {
  if (specialDays.has(localDate) || isWeekendDate(localDate)) {
    return 0
  }

  const dayOfWeek = getDayOfWeek(localDate)

  if (workSettings?.same_hours_every_day) {
    return getUniformWeekdayTargetMinutes(goals, workSettings)
  }

  return goals.find((goal) => goal.day_of_week === dayOfWeek)?.target_minutes ?? 0
}

const buildStartReminder = (
  user: AppUserRow,
  localDate: string,
): UserReminder => ({
  userId: user.id,
  workSessionId: null,
  reminderType: 'START',
  dedupeKey: `start:${localDate}`,
  title: 'Nuba',
  body: 'Hoy todavía no hay fichaje. Entra en Nuba si ya has empezado tu jornada.',
  tag: `nuba-start-${localDate}`,
  url: '/',
})

const buildPauseReminder = (
  user: AppUserRow,
  session: WorkSessionRow,
  breakSession: BreakSessionRow,
): UserReminder => ({
  userId: user.id,
  workSessionId: session.id,
  reminderType: 'PAUSE',
  dedupeKey: `pause:${session.id}:${breakSession.id}`,
  title: 'Nuba',
  body: 'Tu pausa sigue abierta. Entra en Nuba para retomarla o cerrar la jornada.',
  tag: `nuba-pause-${session.id}`,
  url: '/',
  requireInteraction: true,
})

const buildStopReminder = (
  user: AppUserRow,
  session: WorkSessionRow,
): UserReminder => ({
  userId: user.id,
  workSessionId: session.id,
  reminderType: 'STOP',
  dedupeKey: `stop:${session.id}:primary`,
  title: 'Nuba',
  body: 'Tu jornada sigue abierta. Entra en Nuba para revisarla y desfichar.',
  tag: `nuba-stop-${session.id}`,
  url: '/',
  requireInteraction: true,
})

const buildRepeatedStopReminder = (
  user: AppUserRow,
  session: WorkSessionRow,
  repeatIndex: number,
): UserReminder => ({
  userId: user.id,
  workSessionId: session.id,
  reminderType: 'SMART_STOP',
  dedupeKey: `stop:${session.id}:repeat:${repeatIndex}`,
  title: 'Nuba',
  body: 'La jornada continúa abierta. Si ya has terminado, entra en Nuba y desficha.',
  tag: `nuba-stop-repeat-${session.id}-${repeatIndex}`,
  url: '/',
  requireInteraction: true,
})

const hasDeliveryLog = async (
  pushSubscriptionId: string,
  dedupeKey: string,
) => {
  const result = await supabase
    .from('notification_delivery_logs')
    .select('push_subscription_id, dedupe_key')
    .eq('push_subscription_id', pushSubscriptionId)
    .eq('dedupe_key', dedupeKey)
    .limit(1)
    .maybeSingle<NotificationDeliveryLogRow>()

  if (result.error) {
    throw result.error
  }

  return Boolean(result.data)
}

const markDeliverySuccess = async (
  candidate: DeliveryCandidate,
  payload: Record<string, unknown>,
  nowIso: string,
) => {
  const [insertLog, updateSubscription] = await Promise.all([
    supabase.from('notification_delivery_logs').insert({
      user_id: candidate.userId,
      work_session_id: candidate.workSessionId,
      push_subscription_id: candidate.subscription.id,
      reminder_type: candidate.reminderType,
      dedupe_key: candidate.dedupeKey,
      delivered: true,
      payload,
      sent_at: nowIso,
      created_at: nowIso,
    }),
    supabase
      .from('push_subscriptions')
      .update({
        last_success_at: nowIso,
        last_seen_at: nowIso,
        updated_at: nowIso,
        last_failure_at: null,
        failure_count: 0,
      })
      .eq('id', candidate.subscription.id),
  ])

  if (insertLog.error) {
    throw insertLog.error
  }

  if (updateSubscription.error) {
    throw updateSubscription.error
  }
}

const markDeliveryFailure = async (
  subscription: PushSubscriptionRow,
  nowIso: string,
  removeSubscription: boolean,
) => {
  if (removeSubscription) {
    const remove = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('id', subscription.id)

    if (remove.error) {
      throw remove.error
    }

    return
  }

  const update = await supabase
    .from('push_subscriptions')
    .update({
      updated_at: nowIso,
      last_failure_at: nowIso,
      failure_count: subscription.failure_count + 1,
    })
    .eq('id', subscription.id)

  if (update.error) {
    throw update.error
  }
}

const sendPushNotification = async (
  candidate: DeliveryCandidate,
  nowIso: string,
) => {
  const payload = {
    title: candidate.title,
    body: candidate.body,
    url: candidate.url,
    tag: candidate.tag,
    requireInteraction: Boolean(candidate.requireInteraction),
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: candidate.subscription.endpoint,
        keys: {
          p256dh: candidate.subscription.p256dh_key,
          auth: candidate.subscription.auth_key,
        },
      },
      JSON.stringify(payload),
      {
        TTL: 60,
      },
    )

    await markDeliverySuccess(candidate, payload, nowIso)
    return { delivered: true }
  } catch (error) {
    const statusCode =
      error && typeof error === 'object' && 'statusCode' in error
        ? Number((error as { statusCode?: number }).statusCode)
        : null
    const shouldRemove = statusCode === 404 || statusCode === 410

    await markDeliveryFailure(candidate.subscription, nowIso, shouldRemove)

    return {
      delivered: false,
      removed: shouldRemove,
      statusCode,
    }
  }
}

const loadUsersWithSubscriptions = async () => {
  const subscriptionsResult = await supabase
    .from('push_subscriptions')
    .select('*')
    .lt('failure_count', 10)

  if (subscriptionsResult.error) {
    throw subscriptionsResult.error
  }

  const subscriptions = subscriptionsResult.data as PushSubscriptionRow[]

  if (!subscriptions.length) {
    return {
      subscriptions,
      users: [] as AppUserRow[],
      settings: [] as NotificationSettingsRow[],
      workSettings: [] as UserWorkSettingsRow[],
      goals: [] as UserDailyGoalRow[],
    }
  }

  const userIds = [...new Set(subscriptions.map((subscription) => subscription.user_id))]

  const [usersResult, settingsResult, workSettingsResult, goalsResult] = await Promise.all([
    supabase.from('app_users').select('id, email, display_name, timezone').in('id', userIds),
    supabase
      .from('notification_settings')
      .select('user_id, smart_reminders_enabled, remind_start, remind_pause, remind_stop')
      .in('user_id', userIds),
    supabase
      .from('user_work_settings')
      .select('user_id, same_hours_every_day, default_daily_minutes, lunch_counts_as_work_time')
      .in('user_id', userIds),
    supabase
      .from('user_daily_goals')
      .select('user_id, day_of_week, target_minutes')
      .in('user_id', userIds),
  ])

  if (usersResult.error) throw usersResult.error
  if (settingsResult.error) throw settingsResult.error
  if (workSettingsResult.error) throw workSettingsResult.error
  if (goalsResult.error) throw goalsResult.error

  return {
    subscriptions,
    users: usersResult.data as AppUserRow[],
    settings: settingsResult.data as NotificationSettingsRow[],
    workSettings: workSettingsResult.data as UserWorkSettingsRow[],
    goals: goalsResult.data as UserDailyGoalRow[],
  }
}

const buildScheduledReminders = async (now: Date) => {
  const { subscriptions, users, settings, workSettings, goals } =
    await loadUsersWithSubscriptions()

  if (!subscriptions.length || !users.length) {
    return [] as DeliveryCandidate[]
  }

  const settingsByUserId = new Map(settings.map((setting) => [setting.user_id, setting]))
  const workSettingsByUserId = new Map(
    workSettings.map((setting) => [setting.user_id, setting]),
  )
  const goalsByUserId = groupBy(goals, (goal) => goal.user_id)
  const subscriptionsByUserId = groupBy(subscriptions, (subscription) => subscription.user_id)
  const subscribedUserIds = Object.keys(subscriptionsByUserId)

  const openSessionsResult = await supabase
    .from('work_sessions')
    .select('id, user_id, work_date, start_time, end_time, status, goal_minutes')
    .is('end_time', null)
    .in('user_id', subscribedUserIds)

  if (openSessionsResult.error) {
    throw openSessionsResult.error
  }

  const openSessions = (openSessionsResult.data ?? []) as WorkSessionRow[]
  const openSessionsByUserId = new Map<string, WorkSessionRow>()

  openSessions
    .sort(
      (left, right) =>
        new Date(right.start_time).getTime() - new Date(left.start_time).getTime(),
    )
    .forEach((session) => {
      if (!openSessionsByUserId.has(session.user_id)) {
        openSessionsByUserId.set(session.user_id, session)
      }
    })

  const openSessionIds = openSessions.map((session) => session.id)
  let breaksBySessionId: Record<string, BreakSessionRow[]> = {}

  if (openSessionIds.length > 0) {
    const breaksResult = await supabase
      .from('break_sessions')
      .select('id, work_session_id, break_type, start_time, end_time, duration_minutes')
      .in('work_session_id', openSessionIds)

    if (breaksResult.error) {
      throw breaksResult.error
    }

    breaksBySessionId = groupBy(
      (breaksResult.data ?? []) as BreakSessionRow[],
      (workBreak) => workBreak.work_session_id,
    )
  }

  const deliveryCandidates: DeliveryCandidate[] = []
  const localDates = new Set<string>()

  for (const user of users) {
    const notificationSettings = settingsByUserId.get(user.id)

    if (!notificationSettings) {
      continue
    }

    const userSubscriptions = subscriptionsByUserId[user.id] ?? []
    if (!userSubscriptions.length) {
      continue
    }

    const timeZone = user.timezone || 'Europe/Madrid'
    const { localDate, minuteOfDay } = getLocalParts(now, timeZone)
    localDates.add(localDate)

    const openSession = openSessionsByUserId.get(user.id)
    const userGoals = goalsByUserId[user.id] ?? []
    const userWorkSettings = workSettingsByUserId.get(user.id) ?? null

    if (openSession) {
      const sessionBreaks = breaksBySessionId[openSession.id] ?? []
      const openBreak =
        sessionBreaks.find((workBreak) => workBreak.end_time === null) ?? null
      const effectiveBreakMinutes = sessionBreaks.reduce((total, workBreak) => {
        if (
          userWorkSettings?.lunch_counts_as_work_time &&
          workBreak.break_type === 'LUNCH'
        ) {
          return total
        }

        return total + minutesBetween(workBreak.start_time, workBreak.end_time ?? now.toISOString())
      }, 0)
      const workedMinutes = Math.max(
        0,
        minutesBetween(openSession.start_time, now.toISOString()) - effectiveBreakMinutes,
      )

      const dueReminders: UserReminder[] = []

      if (
        notificationSettings.remind_pause &&
        openBreak &&
        minutesBetween(openBreak.start_time, now.toISOString()) >= PAUSE_REMINDER_MINUTES
      ) {
        dueReminders.push(buildPauseReminder(user, openSession, openBreak))
      }

      if (
        notificationSettings.remind_stop &&
        openSession.goal_minutes > 0 &&
        workedMinutes >= openSession.goal_minutes + STOP_GRACE_MINUTES
      ) {
        dueReminders.push(buildStopReminder(user, openSession))

        if (notificationSettings.smart_reminders_enabled) {
          const repeatIndex = Math.floor(
            Math.max(
              0,
              workedMinutes - (openSession.goal_minutes + STOP_GRACE_MINUTES + STOP_REPEAT_INTERVAL_MINUTES),
            ) / STOP_REPEAT_INTERVAL_MINUTES,
          )

          if (
            workedMinutes >=
            openSession.goal_minutes +
              STOP_GRACE_MINUTES +
              STOP_REPEAT_INTERVAL_MINUTES
          ) {
            dueReminders.push(buildRepeatedStopReminder(user, openSession, repeatIndex))
          }
        }
      }

      for (const reminder of dueReminders) {
        for (const subscription of userSubscriptions) {
          deliveryCandidates.push({
            ...reminder,
            subscription,
          })
        }
      }

      continue
    }

    if (!notificationSettings.remind_start || minuteOfDay < START_REMINDER_MINUTE_OF_DAY) {
      continue
    }

    const targetMinutes = getTargetMinutesForDate({
      goals: userGoals,
      localDate,
      specialDays: new Set(),
      workSettings: userWorkSettings,
    })

    if (targetMinutes <= 0) {
      continue
    }

    for (const subscription of userSubscriptions) {
      deliveryCandidates.push({
        ...buildStartReminder(user, localDate),
        subscription,
      })
    }
  }

  if (!deliveryCandidates.length) {
    return []
  }

  const userIds = [...new Set(deliveryCandidates.map((candidate) => candidate.userId))]
  const dates = [...localDates]
  const [todaySessionsResult, specialDaysResult] = await Promise.all([
    dates.length
      ? supabase
          .from('work_sessions')
          .select('user_id, work_date')
          .in('user_id', userIds)
          .in('work_date', dates)
      : Promise.resolve({ data: [], error: null }),
    dates.length
      ? supabase
          .from('calendar_special_days')
          .select('special_date')
          .in('special_date', dates)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (todaySessionsResult.error) {
    throw todaySessionsResult.error
  }

  if (specialDaysResult.error) {
    throw specialDaysResult.error
  }

  const sessionsToday = new Set(
    ((todaySessionsResult.data ?? []) as Array<{ user_id: string; work_date: string }>).map(
      (session) => `${session.user_id}:${session.work_date}`,
    ),
  )
  const specialDays = new Set(
    ((specialDaysResult.data ?? []) as SpecialDayRow[]).map((day) => day.special_date),
  )

  return deliveryCandidates.filter((candidate) => {
    if (candidate.reminderType !== 'START') {
      return true
    }

    if (specialDays.has(candidate.dedupeKey.replace('start:', ''))) {
      return false
    }

    const localDate = candidate.dedupeKey.replace('start:', '')
    return !sessionsToday.has(`${candidate.userId}:${localDate}`)
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  if (request.headers.get('x-nuba-cron-secret') !== cronSecret) {
    return jsonResponse(401, { error: 'Unauthorized' })
  }

  try {
    const now = new Date()
    const nowIso = now.toISOString()
    const candidates = await buildScheduledReminders(now)

    let delivered = 0
    let skipped = 0
    let removed = 0

    for (const candidate of candidates) {
      const alreadySent = await hasDeliveryLog(
        candidate.subscription.id,
        candidate.dedupeKey,
      )

      if (alreadySent) {
        skipped += 1
        continue
      }

      const result = await sendPushNotification(candidate, nowIso)

      if (result.delivered) {
        delivered += 1
      } else {
        skipped += 1
        if (result.removed) {
          removed += 1
        }
      }
    }

    return jsonResponse(200, {
      ok: true,
      evaluated: candidates.length,
      delivered,
      skipped,
      removed,
    })
  } catch (error) {
    return jsonResponse(500, {
      ok: false,
      error: error instanceof Error ? error.message : 'Unexpected error',
    })
  }
})
