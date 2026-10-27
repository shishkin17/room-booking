import {
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  TITLE_MAX_LENGTH,
  WORK_DAY_END,
  WORK_DAY_START,
  type Booking,
  type BookingInput,
  type IsoDate,
  type TimeRange,
} from './booking'
import {
  formatTimeRange,
  isPastDate,
  isToday,
  isValidIsoDate,
  isValidTimeOfDay,
  minutesOfDay,
  toMinutes,
} from './time'

// Single source of truth for business rules: used by the form (client) and by the mock server.

export type ValidationIssueCode =
  | 'INVALID_DATE'
  | 'INVALID_TIME'
  | 'TITLE_TOO_LONG'
  | 'OUTSIDE_WORKING_HOURS'
  | 'START_NOT_BEFORE_END'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'PAST_DATE'
  | 'PAST_TIME'
  | 'OVERLAP'

export type ValidationField = 'date' | 'start' | 'end' | 'title'

export type ValidationIssue = {
  code: ValidationIssueCode
  field: ValidationField
  /** Human-readable message in Russian, ready to show in the UI. */
  message: string
  /** Present only for `OVERLAP`. */
  conflictingBooking?: Booking
}

export type ValidateOptions = {
  now: Date
  /** Id of the booking being edited: it must not conflict with itself (rule 7). */
  excludeId?: string
}

export const VALIDATION_MESSAGES = {
  INVALID_DATE: 'Некорректная дата',
  INVALID_TIME: 'Некорректное время, ожидается формат ЧЧ:ММ',
  TITLE_TOO_LONG: `Название не должно быть длиннее ${TITLE_MAX_LENGTH} символов`,
  OUTSIDE_WORKING_HOURS: `Время должно быть в пределах рабочего дня ${WORK_DAY_START}–${WORK_DAY_END}`,
  START_NOT_BEFORE_END: 'Время окончания должно быть позже времени начала',
  TOO_SHORT: `Минимальная длительность брони — ${MIN_DURATION_MINUTES} минут`,
  TOO_LONG: `Максимальная длительность брони — ${MAX_DURATION_MINUTES} минут`,
  PAST_DATE: 'Нельзя бронировать на прошедшую дату',
  PAST_TIME: 'Нельзя бронировать на уже прошедшее время',
} as const satisfies Record<Exclude<ValidationIssueCode, 'OVERLAP'>, string>

/** `«Время пересекается с бронью 10:00–11:00 «Планёрка»»`; the title part is omitted when empty. */
export function overlapMessage(conflict: Booking): string {
  const title = conflict.title?.trim()
  const suffix = title ? ` «${title}»` : ''
  return `Время пересекается с бронью ${formatTimeRange(conflict)}${suffix}`
}

/** Half-open intervals: touching boundaries (10:00–11:00 vs 11:00–12:00) do NOT overlap. */
export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end)
}

/**
 * Booking on the same date that overlaps `input`, ignoring `excludeId`.
 * When several overlap, the earliest one (by start, then end) is returned, regardless of
 * the order of `existing`.
 */
export function findConflict(
  input: BookingInput,
  existing: readonly Booking[],
  excludeId?: string,
): Booking | undefined {
  let found: Booking | undefined
  for (const booking of existing) {
    if (booking.date !== input.date || booking.id === excludeId) continue
    if (!overlaps(input, booking)) continue
    if (!found || compareByTime(booking, found) < 0) found = booking
  }
  return found
}

/** Sort comparator: by start, then end, then id (stable and deterministic). */
export function compareByTime(a: Booking, b: Booking): number {
  return (
    toMinutes(a.start) - toMinutes(b.start) ||
    toMinutes(a.end) - toMinutes(b.end) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
}

const issue = (code: Exclude<ValidationIssueCode, 'OVERLAP'>, field: ValidationField) => ({
  code,
  field,
  message: VALIDATION_MESSAGES[code],
})

/**
 * Validates all business rules. Returns an empty array when the input is valid.
 *
 * - Format checks run first (`INVALID_DATE`, `INVALID_TIME`); if any of them fails, range
 *   rules are skipped and only format issues (plus `TITLE_TOO_LONG`, which does not depend
 *   on date/time) are returned.
 * - Otherwise all range rules are evaluated and may be returned together, in a fixed order:
 *   date issues, start issues, end issues, title.
 * - `START_NOT_BEFORE_END` suppresses the duration rules; `PAST_DATE` suppresses `PAST_TIME`.
 * - `OVERLAP` is reported last and only when all other rules pass.
 */
export function validateBooking(
  input: BookingInput,
  existing: readonly Booking[],
  options: ValidateOptions,
): ValidationIssue[] {
  const { now, excludeId } = options

  const titleIssues: ValidationIssue[] =
    (input.title?.trim().length ?? 0) > TITLE_MAX_LENGTH ? [issue('TITLE_TOO_LONG', 'title')] : []

  const formatIssues: ValidationIssue[] = []
  if (!isValidIsoDate(input.date)) formatIssues.push(issue('INVALID_DATE', 'date'))
  if (!isValidTimeOfDay(input.start)) formatIssues.push(issue('INVALID_TIME', 'start'))
  if (!isValidTimeOfDay(input.end)) formatIssues.push(issue('INVALID_TIME', 'end'))
  if (formatIssues.length > 0) return [...formatIssues, ...titleIssues]

  const start = toMinutes(input.start)
  const end = toMinutes(input.end)
  const dateIssues: ValidationIssue[] = []
  const startIssues: ValidationIssue[] = []
  const endIssues: ValidationIssue[] = []

  const pastDate = isPastDate(input.date, now)
  if (pastDate) dateIssues.push(issue('PAST_DATE', 'date'))

  if (start < toMinutes(WORK_DAY_START)) startIssues.push(issue('OUTSIDE_WORKING_HOURS', 'start'))
  // Minute precision, same boundary as `isBookingEditable`: a booking starting in the current
  // minute has already started, so it would be read-only right after creation.
  if (!pastDate && isToday(input.date, now) && start <= minutesOfDay(now)) {
    startIssues.push(issue('PAST_TIME', 'start'))
  }

  if (end > toMinutes(WORK_DAY_END)) endIssues.push(issue('OUTSIDE_WORKING_HOURS', 'end'))

  if (start >= end) {
    endIssues.push(issue('START_NOT_BEFORE_END', 'end'))
  } else if (end - start < MIN_DURATION_MINUTES) {
    endIssues.push(issue('TOO_SHORT', 'end'))
  } else if (end - start > MAX_DURATION_MINUTES) {
    endIssues.push(issue('TOO_LONG', 'end'))
  }

  const issues = [...dateIssues, ...startIssues, ...endIssues, ...titleIssues]
  if (issues.length > 0) return issues

  const conflict = findConflict(input, existing, excludeId)
  if (conflict) {
    return [
      {
        code: 'OVERLAP',
        field: 'start',
        message: overlapMessage(conflict),
        conflictingBooking: conflict,
      },
    ]
  }
  return []
}

/** New bookings may be created for today and future dates only (rule 6). */
export function canCreateOnDate(date: IsoDate, now: Date): boolean {
  return !isPastDate(date, now)
}

/**
 * A booking can be edited/deleted only while it has not started yet (product decision, see
 * README). Minute precision: at 12:00:30 a booking starting at 12:00 is already started.
 */
export function isBookingEditable(booking: Booking, now: Date): boolean {
  if (isPastDate(booking.date, now)) return false
  if (!isToday(booking.date, now)) return true
  return toMinutes(booking.start) > minutesOfDay(now)
}
