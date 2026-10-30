import { describe, expect, it } from 'vitest'
import {
  ceilToStep,
  durationMinutes,
  formatTimeRange,
  fromMinutes,
  isPastDate,
  isToday,
  isValidIsoDate,
  isValidTimeOfDay,
  minutesOfDay,
  toIsoDate,
  toMinutes,
} from './time'

// Local-time constructor: timezone-independent.
const NOW = new Date(2026, 9, 27, 12, 7)

describe('toMinutes / fromMinutes', () => {
  it.each([
    ['00:00', 0],
    ['09:00', 540],
    ['09:30', 570],
    ['12:07', 727],
    ['18:00', 1080],
    ['23:59', 1439],
  ])('%s <-> %i', (time, minutes) => {
    expect(toMinutes(time)).toBe(minutes)
    expect(fromMinutes(minutes)).toBe(time)
  })

  it('pads hours and minutes with zeros', () => {
    expect(fromMinutes(5)).toBe('00:05')
    expect(fromMinutes(65)).toBe('01:05')
    expect(fromMinutes(600)).toBe('10:00')
  })

  it('round-trips every minute of the day', () => {
    for (let m = 0; m < 24 * 60; m++) {
      expect(toMinutes(fromMinutes(m))).toBe(m)
    }
  })
})

describe('isValidTimeOfDay', () => {
  it.each(['00:00', '09:00', '12:59', '18:00', '23:59'])('accepts %s', (value) => {
    expect(isValidTimeOfDay(value)).toBe(true)
  })

  it.each(['9:00', '09:0', '24:00', '12:60', '25:00', '', '09-00', '09:00:00', ' 09:00', 'ab:cd'])(
    'rejects %j',
    (value) => {
      expect(isValidTimeOfDay(value)).toBe(false)
    },
  )
})

describe('isValidIsoDate', () => {
  it.each(['2026-10-27', '2026-01-01', '2026-12-31', '2024-02-29', '2026-02-28'])(
    'accepts %s',
    (value) => {
      expect(isValidIsoDate(value)).toBe(true)
    },
  )

  it.each([
    '2026-02-30',
    '2026-02-29', // not a leap year
    '2026-04-31',
    '2026-13-01',
    '2026-00-10',
    '2026-10-00',
    '2026-10-32',
    '2026-1-05',
    '26-10-27',
    '2026/10/27',
    '2026-10-27T00:00',
    '',
  ])('rejects %j', (value) => {
    expect(isValidIsoDate(value)).toBe(false)
  })
})

describe('toIsoDate / minutesOfDay', () => {
  it('formats the local calendar date with padding', () => {
    expect(toIsoDate(NOW)).toBe('2026-10-27')
    expect(toIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(toIsoDate(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05')
  })

  it('returns minutes since local midnight, truncating seconds', () => {
    expect(minutesOfDay(NOW)).toBe(727)
    expect(minutesOfDay(new Date(2026, 9, 27, 0, 0))).toBe(0)
    expect(minutesOfDay(new Date(2026, 9, 27, 23, 59, 59))).toBe(1439)
  })
})

describe('isPastDate / isToday', () => {
  it('compares calendar dates, not times', () => {
    expect(isPastDate('2026-10-26', NOW)).toBe(true)
    expect(isPastDate('2025-12-31', NOW)).toBe(true)
    expect(isPastDate('2026-10-27', NOW)).toBe(false)
    expect(isPastDate('2026-10-28', NOW)).toBe(false)
    expect(isPastDate('2026-10-27', new Date(2026, 9, 27, 23, 59))).toBe(false)
  })

  it('detects today', () => {
    expect(isToday('2026-10-27', NOW)).toBe(true)
    expect(isToday('2026-10-26', NOW)).toBe(false)
    expect(isToday('2026-10-28', NOW)).toBe(false)
  })
})

describe('ceilToStep', () => {
  it.each([
    [727, 15, 735], // 12:07 -> 12:15
    [720, 15, 720], // exact multiple stays
    [721, 15, 735],
    [734, 15, 735],
    [0, 15, 0],
    [1439, 15, 1440],
    [61, 30, 90],
  ])('ceilToStep(%i, %i) = %i', (minutes, step, expected) => {
    expect(ceilToStep(minutes, step)).toBe(expected)
  })
})

describe('durationMinutes / formatTimeRange', () => {
  it('computes duration', () => {
    expect(durationMinutes({ start: '10:00', end: '11:30' })).toBe(90)
    expect(durationMinutes({ start: '11:00', end: '10:00' })).toBe(-60)
  })

  it('formats with an en dash', () => {
    expect(formatTimeRange({ start: '10:00', end: '11:30' })).toBe('10:00–11:30')
  })
})
