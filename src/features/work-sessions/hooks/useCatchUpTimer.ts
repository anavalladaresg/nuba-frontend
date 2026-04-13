import { useEffect, useEffectEvent, useRef, useState } from 'react'

type UseCatchUpTimerOptions = {
  value: number
  enabled?: boolean
  minAnimatedDeltaSeconds?: number
  maxAnimatedDeltaSeconds?: number
  minAnimationDurationMs?: number
  maxAnimationDurationMs?: number
  respectReducedMotion?: boolean
}

type UseCatchUpTimerResult = {
  previousTime: number
  currentTime: number
  displayTime: number
  isAnimating: boolean
  animationDurationSeconds: number
}

const sanitizeSeconds = (value: number) => Math.max(0, Math.floor(value))

const getAnimationDurationMs = (
  deltaSeconds: number,
  minAnimationDurationMs: number,
  maxAnimationDurationMs: number,
  maxAnimatedDeltaSeconds: number,
) => {
  if (deltaSeconds <= 0) {
    return 0
  }

  const normalizedDelta = Math.min(deltaSeconds, maxAnimatedDeltaSeconds) / maxAnimatedDeltaSeconds
  return Math.round(
    minAnimationDurationMs +
      (maxAnimationDurationMs - minAnimationDurationMs) * Math.sqrt(normalizedDelta),
  )
}

export function useCatchUpTimer({
  enabled = true,
  maxAnimatedDeltaSeconds = 2 * 60 * 60,
  maxAnimationDurationMs = 1500,
  minAnimatedDeltaSeconds = 5,
  minAnimationDurationMs = 700,
  respectReducedMotion = true,
  value,
}: UseCatchUpTimerOptions): UseCatchUpTimerResult {
  const initialValue = sanitizeSeconds(value)
  const [displayTime, setDisplayTime] = useState(initialValue)
  const [previousTime, setPreviousTime] = useState(initialValue)
  const [currentTime, setCurrentTime] = useState(initialValue)
  const [isAnimating, setIsAnimating] = useState(false)
  const [animationDurationSeconds, setAnimationDurationSeconds] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const animationTimeoutRef = useRef<number | null>(null)
  const displayTimeRef = useRef(initialValue)
  const latestValueRef = useRef(initialValue)
  const wasBackgroundedRef = useRef(false)
  const shouldAnimateNextSyncRef = useRef(false)

  const syncImmediately = useEffectEvent((nextValue: number) => {
    if (animationTimeoutRef.current !== null) {
      window.clearTimeout(animationTimeoutRef.current)
      animationTimeoutRef.current = null
    }

    displayTimeRef.current = nextValue
    setDisplayTime(nextValue)
    setPreviousTime(nextValue)
    setCurrentTime(nextValue)
    setIsAnimating(false)
    setAnimationDurationSeconds(0)
  })

  const startAnimation = useEffectEvent((fromValue: number, toValue: number) => {
    const deltaSeconds = Math.abs(toValue - fromValue)
    const durationMs = getAnimationDurationMs(
      deltaSeconds,
      minAnimationDurationMs,
      maxAnimationDurationMs,
      maxAnimatedDeltaSeconds,
    )

    if (durationMs === 0) {
      syncImmediately(latestValueRef.current)
      return
    }

    if (animationTimeoutRef.current !== null) {
      window.clearTimeout(animationTimeoutRef.current)
    }

    displayTimeRef.current = fromValue
    setDisplayTime(fromValue)
    setPreviousTime(fromValue)
    setCurrentTime(toValue)
    setIsAnimating(true)
    setAnimationDurationSeconds(durationMs / 1000)
    animationTimeoutRef.current = window.setTimeout(() => {
      shouldAnimateNextSyncRef.current = false
      syncImmediately(latestValueRef.current)
    }, durationMs)
  })

  useEffect(() => {
    if (!respectReducedMotion || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleMotionPreferenceChange = () => setPrefersReducedMotion(mediaQuery.matches)

    handleMotionPreferenceChange()
    mediaQuery.addEventListener('change', handleMotionPreferenceChange)

    return () => mediaQuery.removeEventListener('change', handleMotionPreferenceChange)
  }, [respectReducedMotion])

  useEffect(() => {
    const markBackgrounded = () => {
      wasBackgroundedRef.current = true
    }

    const queueCatchUp = () => {
      if (document.visibilityState === 'hidden' || !wasBackgroundedRef.current) {
        return
      }

      shouldAnimateNextSyncRef.current = true
      wasBackgroundedRef.current = false
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        markBackgrounded()
        return
      }

      queueCatchUp()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', queueCatchUp)
    window.addEventListener('blur', markBackgrounded)
    window.addEventListener('pagehide', markBackgrounded)
    window.addEventListener('pageshow', queueCatchUp)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', queueCatchUp)
      window.removeEventListener('blur', markBackgrounded)
      window.removeEventListener('pagehide', markBackgrounded)
      window.removeEventListener('pageshow', queueCatchUp)
    }
  }, [])

  useEffect(() => {
    const nextValue = sanitizeSeconds(value)
    latestValueRef.current = nextValue

    if (isAnimating) {
      if (nextValue < displayTimeRef.current) {
        syncImmediately(nextValue)
      }

      return
    }

    if (!enabled || prefersReducedMotion) {
      shouldAnimateNextSyncRef.current = false
      syncImmediately(nextValue)
      return
    }

    const deltaSeconds = nextValue - displayTimeRef.current

    if (shouldAnimateNextSyncRef.current && deltaSeconds >= minAnimatedDeltaSeconds) {
      shouldAnimateNextSyncRef.current = false
      startAnimation(displayTimeRef.current, nextValue)
      return
    }

    shouldAnimateNextSyncRef.current = false
    syncImmediately(nextValue)
  }, [enabled, isAnimating, minAnimatedDeltaSeconds, prefersReducedMotion, value])

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current !== null) {
        window.clearTimeout(animationTimeoutRef.current)
      }
    }
  }, [])

  return {
    animationDurationSeconds,
    currentTime,
    displayTime,
    isAnimating,
    previousTime,
  }
}
