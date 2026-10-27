import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import type { Booking } from '@/domain/booking'
import {
  formatDateValue,
  formatTimeValue,
  getInitialValues,
  parseDateValue,
  parseTimeValue,
  suggestSlot,
} from './bookingForm'
import { INVALID_INPUT } from './schema'

const at = (hours: number, minutes = 0) => new Date(2026, 9, 27, hours, minutes)
const TODAY = '2026-10-27'
const TOMORROW = '2026-10-28'
const booking = (id: string, start: string, end: string, date = TOMORROW): Booking => ({
  id,
  date,
  start,
  end,
})

describe('suggestSlot', () => {
  it('starts at 09:00 on a free future day', () => {
    expect(suggestSlot(TOMORROW, [], at(10))).toEqual({ start: '09:00', end: '10:00' })
  })

  it('starts at the next step after now today', () => {
    expect(suggestSlot(TODAY, [], at(10, 7))).toEqual({ start: '10:15', end: '11:15' })
  })

  it('skips taken time and too short gaps, shrinking to the free window', () => {
    const bookings = [booking('a', '09:00', '10:00'), booking('b', '10:15', '11:00')]
    // 10:00–10:15 is too short; 11:00–18:00 is free.
    expect(suggestSlot(TOMORROW, bookings, at(8))).toEqual({ start: '11:00', end: '12:00' })
    const tight = [booking('a', '09:00', '10:00'), booking('b', '10:45', '18:00')]
    expect(suggestSlot(TOMORROW, tight, at(8))).toEqual({ start: '10:00', end: '10:45' })
  })

  it('falls back to a slot inside working hours when nothing is free', () => {
    const full = [booking('a', '09:00', '18:00', TODAY)]
    expect(suggestSlot(TODAY, full, at(12, 1))).toEqual({ start: '12:15', end: '13:15' })
    expect(suggestSlot(TODAY, [], at(17, 40))).toEqual({ start: '17:00', end: '18:00' })
    expect(suggestSlot('2026-10-20', [], at(12))).toEqual({ start: '09:00', end: '10:00' })
  })
})

describe('getInitialValues', () => {
  it('uses the booking in edit mode', () => {
    const edited = { ...booking('a', '10:00', '11:00'), title: 'Планёрка' }
    expect(getInitialValues({ date: TODAY, booking: edited, bookings: [], now: at(8) })).toEqual({
      date: TOMORROW,
      start: '10:00',
      end: '11:00',
      title: 'Планёрка',
    })
  })

  it('prefers initialRange over the suggestion in create mode', () => {
    const values = getInitialValues({
      date: TOMORROW,
      initialRange: { start: '14:00', end: '15:30' },
      bookings: [],
      now: at(8),
    })
    expect(values).toEqual({ date: TOMORROW, start: '14:00', end: '15:30', title: '' })
  })
})

describe('picker boundary', () => {
  it('round-trips valid values', () => {
    expect(formatDateValue(parseDateValue('2026-10-27'))).toBe('2026-10-27')
    expect(formatTimeValue(parseTimeValue('09:45'))).toBe('09:45')
  })

  it('maps empty to null/"" and partial input to INVALID_INPUT', () => {
    expect(parseTimeValue('')).toBeNull()
    expect(formatTimeValue(null)).toBe('')
    expect(formatTimeValue(dayjs(NaN))).toBe(INVALID_INPUT)
    expect(formatDateValue(dayjs(NaN))).toBe(INVALID_INPUT)
    expect(parseDateValue(INVALID_INPUT)?.isValid()).toBe(false)
  })
})
