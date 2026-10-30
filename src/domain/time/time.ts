import type { IsoDate, TimeOfDay, TimeRange } from '@/domain/booking'

// All functions work in the browser's local time zone; `now` is always injected for testability.

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

const pad2 = (value: number): string => String(value).padStart(2, '0')

/** `'09:30'` -> `570`. Assumes a valid `HH:mm` string (see `isValidTimeOfDay`). */
export function toMinutes(time: TimeOfDay): number {
  const [hours, minutes] = time.split(':')
  return Number(hours) * 60 + Number(minutes)
}

/** `570` -> `'09:30'`. Expects a non-negative integer number of minutes (1440 gives `'24:00'`). */
export function fromMinutes(minutes: number): TimeOfDay {
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`
}

/** Strict `HH:mm`, 00:00–23:59. */
export function isValidTimeOfDay(value: string): boolean {
  return TIME_RE.test(value)
}

/** Strict `YYYY-MM-DD` that is a real calendar date (no `2026-02-30`). */
export function isValidIsoDate(value: string): boolean {
  const match = DATE_RE.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1) return false
  // Day 0 of the next month is the last day of `month`.
  const daysInMonth = new Date(year, month, 0).getDate()
  return day <= daysInMonth
}

/** Local calendar date of `date` as `YYYY-MM-DD`. */
export function toIsoDate(date: Date): IsoDate {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** Minutes since local midnight for `now` (seconds are truncated). */
export function minutesOfDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes()
}

/** `date` is strictly before today's local date. Expects a valid `YYYY-MM-DD`. */
export function isPastDate(date: IsoDate, now: Date): boolean {
  // Zero-padded ISO dates compare correctly as strings.
  return date < toIsoDate(now)
}

export function isToday(date: IsoDate, now: Date): boolean {
  return date === toIsoDate(now)
}

/** Rounds minutes up to the next multiple of `step` (e.g. 12:07 -> 12:15 for step 15). */
export function ceilToStep(minutes: number, step: number): number {
  return Math.ceil(minutes / step) * step
}

/** Length of a range in minutes (negative when `end` is before `start`). */
export function durationMinutes(range: TimeRange): number {
  return toMinutes(range.end) - toMinutes(range.start)
}

/** `'10:00–11:30'` (en dash), for messages and aria-labels. */
export function formatTimeRange(range: TimeRange): string {
  return `${range.start}–${range.end}`
}
