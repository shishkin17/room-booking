import {
  TIME_STEP_MINUTES,
  WORK_DAY_END,
  WORK_DAY_START,
  type Booking,
  type IsoDate,
  type TimeOfDay,
} from '@/domain/booking'
import { compareByTime, isBookingEditable } from '@/domain/rules'
import {
  ceilToStep,
  fromMinutes,
  isPastDate,
  isToday,
  minutesOfDay,
  toMinutes,
} from '@/domain/time'

export type ScheduleItem =
  | { kind: 'booking'; booking: Booking; isPast: boolean }
  | { kind: 'free'; start: TimeOfDay; end: TimeOfDay; isPast: boolean }

/**
 * Builds the day agenda between WORK_DAY_START and WORK_DAY_END: bookings sorted by start,
 * gaps between them as `free` items. For today, a free gap crossing "now" is split at
 * `now` rounded up to TIME_STEP_MINUTES into a past part and a bookable part.
 * For past dates every item is `isPast`; for future dates none is.
 * A booking is `isPast` once its start has passed (same as `!isBookingEditable`).
 * Free gaps shorter than MIN_DURATION_MINUTES are still returned (UI shows them as
 * non-bookable); zero-length gaps are never returned.
 * Bookings from other dates are ignored defensively; overlapping input bookings (should not
 * happen) are all listed and produce no free gap between them.
 */
export function buildDaySchedule(
  date: IsoDate,
  bookings: readonly Booking[],
  now: Date,
): ScheduleItem[] {
  const dayStart = toMinutes(WORK_DAY_START)
  const dayEnd = toMinutes(WORK_DAY_END)
  // Free time strictly before this minute is past.
  const pastBoundary = isPastDate(date, now)
    ? Infinity
    : isToday(date, now)
      ? ceilToStep(minutesOfDay(now), TIME_STEP_MINUTES)
      : -Infinity

  const items: ScheduleItem[] = []

  const pushFree = (from: number, to: number) => {
    const start = Math.max(from, dayStart)
    const end = Math.min(to, dayEnd)
    if (start >= end) return
    if (end <= pastBoundary) {
      items.push({ kind: 'free', start: fromMinutes(start), end: fromMinutes(end), isPast: true })
    } else if (start >= pastBoundary) {
      items.push({ kind: 'free', start: fromMinutes(start), end: fromMinutes(end), isPast: false })
    } else {
      const split = fromMinutes(pastBoundary)
      items.push({ kind: 'free', start: fromMinutes(start), end: split, isPast: true })
      items.push({ kind: 'free', start: split, end: fromMinutes(end), isPast: false })
    }
  }

  const sorted = bookings.filter((booking) => booking.date === date).sort(compareByTime)

  let cursor = dayStart
  for (const booking of sorted) {
    pushFree(cursor, toMinutes(booking.start))
    items.push({ kind: 'booking', booking, isPast: !isBookingEditable(booking, now) })
    cursor = Math.max(cursor, toMinutes(booking.end))
  }
  pushFree(cursor, dayEnd)

  return items
}
