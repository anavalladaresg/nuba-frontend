import { describe, expect, it } from 'vitest'
import {
  formatClockFromSeconds,
  formatMinutesAsClock,
  formatMinutesCompact,
  getStatusLabel,
} from './format'

describe('format utilities', () => {
  it('formats seconds as HH:mm:ss', () => {
    expect(formatClockFromSeconds(13338)).toBe('03:42:18')
  })

  it('formats minutes as compact hours and minutes', () => {
    expect(formatMinutesCompact(230)).toBe('3h 50m')
  })

  it('formats minutes as H:mm for compact calendar displays', () => {
    expect(formatMinutesAsClock(31)).toBe('0:31')
    expect(formatMinutesAsClock(230)).toBe('3:50')
  })

  it('maps backend status labels to readable text', () => {
    expect(getStatusLabel('PAUSED')).toBe('En pausa')
  })
})
