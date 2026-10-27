import { describe, expect, it } from 'vitest'
import type { Booking } from './booking'
import { buildDaySchedule, type ScheduleItem } from './schedule'

// Local-time constructor: timezone-independent. "Now" is 2026-10-27 12:07 (rounds up to 12:15).
const NOW = new Date(2026, 9, 27, 12, 7)
const TODAY = '2026-10-27'
const TOMORROW = '2026-10-28'
const YESTERDAY = '2026-10-26'

const booking = (id: string, start: string, end: string, date = TOMORROW): Booking => ({
  id,
  date,
  start,
  end,
})

/** Compact view: `free 09:00–10:00` / `booking a` with a `(past)` marker. */
const view = (items: ScheduleItem[]) =>
  items.map((item) => {
    const label =
      item.kind === 'free' ? `free ${item.start}–${item.end}` : `booking ${item.booking.id}`
    return item.isPast ? `${label} (past)` : label
  })

describe('buildDaySchedule', () => {
  it('empty future day is one free gap 09:00–18:00', () => {
    expect(buildDaySchedule(TOMORROW, [], NOW)).toEqual([
      { kind: 'free', start: '09:00', end: '18:00', isPast: false },
    ])
  })

  it('interleaves bookings and free gaps on a future day', () => {
    const items = buildDaySchedule(
      TOMORROW,
      [booking('a', '10:00', '11:00'), booking('b', '13:00', '14:30')],
      NOW,
    )
    expect(view(items)).toEqual([
      'free 09:00–10:00',
      'booking a',
      'free 11:00–13:00',
      'booking b',
      'free 14:30–18:00',
    ])
  })

  it('keeps the booking object itself', () => {
    const a = booking('a', '10:00', '11:00')
    expect(buildDaySchedule(TOMORROW, [a], NOW)[1]).toEqual({
      kind: 'booking',
      booking: a,
      isPast: false,
    })
  })

  it('sorts unsorted input by start without mutating it', () => {
    const input = [
      booking('c', '15:00', '16:00'),
      booking('a', '09:00', '10:00'),
      booking('b', '11:00', '12:00'),
    ]
    const snapshot = [...input]
    expect(view(buildDaySchedule(TOMORROW, input, NOW))).toEqual([
      'booking a',
      'free 10:00–11:00',
      'booking b',
      'free 12:00–15:00',
      'booking c',
      'free 16:00–18:00',
    ])
    expect(input).toEqual(snapshot)
  })

  it('adjacent bookings and bookings at day boundaries produce no zero-length gaps', () => {
    const items = buildDaySchedule(
      TOMORROW,
      [
        booking('a', '09:00', '11:00'),
        booking('b', '11:00', '12:00'),
        booking('c', '16:00', '18:00'),
      ],
      NOW,
    )
    expect(view(items)).toEqual(['booking a', 'booking b', 'free 12:00–16:00', 'booking c'])
  })

  it('returns gaps shorter than the minimum duration', () => {
    const items = buildDaySchedule(
      TOMORROW,
      [booking('a', '09:00', '10:00'), booking('b', '10:15', '12:00')],
      NOW,
    )
    expect(view(items)).toEqual(['booking a', 'free 10:00–10:15', 'booking b', 'free 12:00–18:00'])
  })

  it('ignores bookings from other dates', () => {
    const items = buildDaySchedule(
      TOMORROW,
      [booking('x', '10:00', '11:00', TODAY), booking('a', '13:00', '14:00')],
      NOW,
    )
    expect(view(items)).toEqual(['free 09:00–13:00', 'booking a', 'free 14:00–18:00'])
  })

  it('past day: everything is past', () => {
    const items = buildDaySchedule(YESTERDAY, [booking('a', '10:00', '11:00', YESTERDAY)], NOW)
    expect(view(items)).toEqual([
      'free 09:00–10:00 (past)',
      'booking a (past)',
      'free 11:00–18:00 (past)',
    ])
  })

  it('past empty day is one past gap', () => {
    expect(buildDaySchedule(YESTERDAY, [], NOW)).toEqual([
      { kind: 'free', start: '09:00', end: '18:00', isPast: true },
    ])
  })

  it('today, empty: splits the day at now rounded up to the step', () => {
    expect(buildDaySchedule(TODAY, [], NOW)).toEqual([
      { kind: 'free', start: '09:00', end: '12:15', isPast: true },
      { kind: 'free', start: '12:15', end: '18:00', isPast: false },
    ])
  })

  it('today: splits only the gap containing now; bookings are past once started', () => {
    const items = buildDaySchedule(
      TODAY,
      [
        booking('done', '09:00', '10:00', TODAY),
        booking('running', '10:30', '12:00', TODAY),
        booking('later', '15:00', '16:00', TODAY),
      ],
      NOW,
    )
    expect(view(items)).toEqual([
      'booking done (past)',
      'free 10:00–10:30 (past)',
      'booking running (past)',
      'free 12:00–12:15 (past)',
      'free 12:15–15:00',
      'booking later',
      'free 16:00–18:00',
    ])
  })

  it('today: booking that started before now and is still running is past', () => {
    const items = buildDaySchedule(TODAY, [booking('a', '12:00', '13:00', TODAY)], NOW)
    expect(view(items)).toEqual(['free 09:00–12:00 (past)', 'booking a (past)', 'free 13:00–18:00'])
  })

  it('today: no split when now is exactly on a step and at a gap boundary', () => {
    const now = new Date(2026, 9, 27, 12, 0)
    const items = buildDaySchedule(TODAY, [booking('a', '11:00', '12:00', TODAY)], now)
    expect(view(items)).toEqual(['free 09:00–11:00 (past)', 'booking a (past)', 'free 12:00–18:00'])
  })

  it('today: a booking starting right after the rounded now stays editable', () => {
    const items = buildDaySchedule(TODAY, [booking('a', '12:15', '13:00', TODAY)], NOW)
    expect(view(items)).toEqual(['free 09:00–12:15 (past)', 'booking a', 'free 13:00–18:00'])
  })

  it('today before working hours: nothing is past', () => {
    const now = new Date(2026, 9, 27, 7, 30)
    expect(view(buildDaySchedule(TODAY, [], now))).toEqual(['free 09:00–18:00'])
  })

  it('today after working hours: everything is past', () => {
    const now = new Date(2026, 9, 27, 19, 0)
    const items = buildDaySchedule(TODAY, [booking('a', '17:00', '18:00', TODAY)], now)
    expect(view(items)).toEqual(['free 09:00–17:00 (past)', 'booking a (past)'])
  })

  it('today at 17:50: the last 10 minutes round up to 18:00 and are past', () => {
    const now = new Date(2026, 9, 27, 17, 50)
    expect(view(buildDaySchedule(TODAY, [], now))).toEqual(['free 09:00–18:00 (past)'])
  })

  it('defensive: overlapping input bookings produce no gap between them', () => {
    const items = buildDaySchedule(
      TOMORROW,
      [booking('a', '10:00', '12:00'), booking('b', '11:00', '11:30')],
      NOW,
    )
    expect(view(items)).toEqual(['free 09:00–10:00', 'booking a', 'booking b', 'free 12:00–18:00'])
  })
})
