/** Calendar date in local time, `YYYY-MM-DD`. */
export type IsoDate = string
/** Time of day, `HH:mm` (24h). */
export type TimeOfDay = string

export type Booking = {
  id: string
  date: IsoDate
  start: TimeOfDay
  end: TimeOfDay
  title?: string
}

export type BookingInput = Omit<Booking, 'id'>
export type BookingPatch = Partial<BookingInput>

export type TimeRange = { start: TimeOfDay; end: TimeOfDay }

export const WORK_DAY_START: TimeOfDay = '09:00'
export const WORK_DAY_END: TimeOfDay = '18:00'
export const MIN_DURATION_MINUTES = 30
export const MAX_DURATION_MINUTES = 120
/** Granularity of time pickers and of "now" rounding in the schedule. */
export const TIME_STEP_MINUTES = 15
export const TITLE_MAX_LENGTH = 100
