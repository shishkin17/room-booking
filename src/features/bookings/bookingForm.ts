import dayjs, { type Dayjs } from 'dayjs'
import {
  MIN_DURATION_MINUTES,
  TIME_STEP_MINUTES,
  WORK_DAY_END,
  WORK_DAY_START,
  type Booking,
  type IsoDate,
  type TimeOfDay,
  type TimeRange,
} from '@/domain/booking'
import { buildDaySchedule } from '@/domain/schedule'
import {
  ceilToStep,
  fromMinutes,
  isToday,
  isValidIsoDate,
  isValidTimeOfDay,
  minutesOfDay,
  toMinutes,
} from '@/domain/time'
import { INVALID_INPUT, type BookingFormValues } from './schema'

const DEFAULT_DURATION_MINUTES = 60

/**
 * Prefill for a new booking: the first bookable free window (not in the past, at least
 * MIN_DURATION_MINUTES long), up to 60 minutes. Falls back to the next step after "now"
 * (today) or the start of the working day, even if that slot is taken: validation will say so.
 */
export function suggestSlot(date: IsoDate, bookings: readonly Booking[], now: Date): TimeRange {
  for (const item of buildDaySchedule(date, bookings, now)) {
    if (item.kind !== 'free' || item.isPast) continue
    const start = toMinutes(item.start)
    const end = toMinutes(item.end)
    if (end - start < MIN_DURATION_MINUTES) continue
    return { start: item.start, end: fromMinutes(Math.min(start + DEFAULT_DURATION_MINUTES, end)) }
  }

  const dayStart = toMinutes(WORK_DAY_START)
  const dayEnd = toMinutes(WORK_DAY_END)
  const earliest = isToday(date, now) ? ceilToStep(minutesOfDay(now), TIME_STEP_MINUTES) : dayStart
  const start = Math.min(Math.max(dayStart, earliest), dayEnd - DEFAULT_DURATION_MINUTES)
  return { start: fromMinutes(start), end: fromMinutes(start + DEFAULT_DURATION_MINUTES) }
}

export type InitialValuesParams = {
  date: IsoDate
  booking?: Booking
  initialRange?: TimeRange
  /** Bookings already known for `date` (used only to suggest a free slot). */
  bookings: readonly Booking[]
  now: Date
}

export function getInitialValues({
  date,
  booking,
  initialRange,
  bookings,
  now,
}: InitialValuesParams): BookingFormValues {
  if (booking) {
    return {
      date: booking.date,
      start: booking.start,
      end: booking.end,
      title: booking.title ?? '',
    }
  }
  const range = initialRange ?? suggestSlot(date, bookings, now)
  return { date, start: range.start, end: range.end, title: '' }
}

// Picker boundary: form strings <-> dayjs. Time values use a fixed date; only the time matters.
const TIME_BASE_DATE = '2000-01-01'

export function parseDateValue(value: string): Dayjs | null {
  if (!isValidIsoDate(value)) return value === '' ? null : dayjs(NaN)
  return dayjs(value)
}

export function parseTimeValue(value: string): Dayjs | null {
  if (!isValidTimeOfDay(value)) return value === '' ? null : dayjs(NaN)
  return dayjs(`${TIME_BASE_DATE}T${value}`)
}

export function formatDateValue(value: Dayjs | null): IsoDate {
  if (value === null) return ''
  return value.isValid() ? value.format('YYYY-MM-DD') : INVALID_INPUT
}

export function formatTimeValue(value: Dayjs | null): TimeOfDay {
  if (value === null) return ''
  return value.isValid() ? value.format('HH:mm') : INVALID_INPUT
}
