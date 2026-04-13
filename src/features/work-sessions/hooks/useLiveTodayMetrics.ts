import { useEffect, useEffectEvent, useState } from 'react'
import type {
  TodayWorkSessionsResponse,
  WorkSession,
  WorkTimelineEvent,
} from '../../../shared/types/work-session'

const toTimestamp = (value: string | null | undefined) => {
  if (!value) {
    return null
  }

  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

const secondsBetween = (startMs: number, endMs: number) =>
  Math.max(0, Math.floor((endMs - startMs) / 1000))

const getTimelineEventTimestamp = (event: WorkTimelineEvent) =>
  toTimestamp(event.occurredAt ?? event.timestamp ?? event.eventTime)

const getSessionTimeline = (
  timeline: WorkTimelineEvent[],
  sessionId: string,
) =>
  timeline
    .filter((event) => event.sessionId === sessionId)
    .sort((left, right) => {
      const leftTime = getTimelineEventTimestamp(left) ?? 0
      const rightTime = getTimelineEventTimestamp(right) ?? 0
      return leftTime - rightTime
    })

const getBreakSecondsUntil = (
  timeline: WorkTimelineEvent[],
  sessionId: string,
  untilMs: number,
  includeOpenBreak: boolean,
) => {
  let totalSeconds = 0
  let breakStartMs: number | null = null

  getSessionTimeline(timeline, sessionId).forEach((event) => {
    const eventMs = getTimelineEventTimestamp(event)

    if (eventMs === null || eventMs > untilMs) {
      return
    }

    if (event.type === 'BREAK_STARTED') {
      breakStartMs ??= eventMs
      return
    }

    if (event.type === 'BREAK_ENDED' && breakStartMs !== null) {
      totalSeconds += secondsBetween(breakStartMs, Math.min(eventMs, untilMs))
      breakStartMs = null
    }
  })

  if (includeOpenBreak && breakStartMs !== null) {
    totalSeconds += secondsBetween(breakStartMs, untilMs)
  }

  return totalSeconds
}

const getActiveBreakStartMs = (todayData: TodayWorkSessionsResponse) =>
  toTimestamp(todayData.activeBreak?.startTime ?? todayData.activeBreak?.startedAt)

const getFallbackWorkedSeconds = (
  todayData: TodayWorkSessionsResponse,
  session: WorkSession,
  nowMs: number,
) => {
  const startMs = toTimestamp(session.startTime)

  if (startMs === null) {
    return (session.workedMinutes ?? 0) * 60
  }

  const activeBreakStartMs = getActiveBreakStartMs(todayData)
  const isOpenSession = !session.endTime
  const endMs =
    isOpenSession && todayData.paused
      ? activeBreakStartMs ?? nowMs
      : toTimestamp(session.endTime) ?? nowMs
  const activeBreakRoundedSeconds =
    isOpenSession && todayData.paused && activeBreakStartMs !== null
      ? (todayData.activeBreak?.durationMinutes ?? 0) * 60
      : 0
  const completedBreakSeconds = Math.max(
    0,
    (session.breakMinutes ?? 0) * 60 - activeBreakRoundedSeconds,
  )

  return Math.max(0, secondsBetween(startMs, endMs) - completedBreakSeconds)
}

const getSessionWorkedSeconds = (
  todayData: TodayWorkSessionsResponse,
  session: WorkSession,
  nowMs: number,
) => {
  const startMs = toTimestamp(session.startTime)

  if (startMs === null || todayData.timeline.length === 0) {
    return getFallbackWorkedSeconds(todayData, session, nowMs)
  }

  const isOpenSession = !session.endTime
  const activeBreakStartMs = getActiveBreakStartMs(todayData)
  const endMs =
    isOpenSession && todayData.paused
      ? activeBreakStartMs ?? nowMs
      : toTimestamp(session.endTime) ?? nowMs
  const breakSeconds = getBreakSecondsUntil(
    todayData.timeline,
    session.id,
    endMs,
    false,
  )

  return Math.max(0, secondsBetween(startMs, endMs) - breakSeconds)
}

const getLiveBreakSeconds = (
  todayData: TodayWorkSessionsResponse,
  nowMs: number,
) => {
  if (todayData.timeline.length > 0) {
    return todayData.sessions.reduce((total, session) => {
      const endMs = toTimestamp(session.endTime) ?? nowMs
      return (
        total +
        getBreakSecondsUntil(
          todayData.timeline,
          session.id,
          endMs,
          !session.endTime && todayData.paused,
        )
      )
    }, 0)
  }

  const activeBreakStartMs = getActiveBreakStartMs(todayData)
  const activeBreakSeconds =
    todayData.paused && activeBreakStartMs !== null
      ? secondsBetween(activeBreakStartMs, nowMs)
      : 0
  const activeBreakRoundedSeconds =
    todayData.paused ? (todayData.activeBreak?.durationMinutes ?? 0) * 60 : 0
  const completedBreakSeconds = Math.max(
    0,
    (todayData.summary.breakMinutes ?? 0) * 60 - activeBreakRoundedSeconds,
  )

  return completedBreakSeconds + activeBreakSeconds
}

export function calculateLiveTodayMetrics(
  todayData: TodayWorkSessionsResponse | undefined,
  nowMs: number,
) {
  if (!todayData) {
    return {
      liveBreakSeconds: 0,
      liveWorkedSeconds: 0,
    }
  }

  return {
    liveWorkedSeconds: todayData.sessions.reduce(
      (total, session) => total + getSessionWorkedSeconds(todayData, session, nowMs),
      0,
    ),
    liveBreakSeconds: getLiveBreakSeconds(todayData, nowMs),
  }
}

export function useLiveTodayMetrics(
  todayData: TodayWorkSessionsResponse | undefined,
  syncedAt: number,
) {
  const [now, setNow] = useState(() => Date.now())
  const refreshNow = useEffectEvent(() => setNow(Date.now()))

  useEffect(() => {
    refreshNow()
  }, [syncedAt, todayData?.paused, todayData?.summary.hasOpenSession])

  useEffect(() => {
    if (!todayData?.summary.hasOpenSession) {
      return undefined
    }

    const handleForegroundSync = () => {
      if (document.visibilityState === 'hidden') {
        return
      }

      refreshNow()
    }

    const handleVisibilityChange = () => handleForegroundSync()
    const intervalId = window.setInterval(() => refreshNow(), 1000)

    handleForegroundSync()
    window.addEventListener('focus', handleForegroundSync)
    window.addEventListener('pageshow', handleForegroundSync)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleForegroundSync)
      window.removeEventListener('pageshow', handleForegroundSync)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [todayData?.summary.hasOpenSession])

  return calculateLiveTodayMetrics(todayData, now)
}
