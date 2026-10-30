import { describe, expect, it } from 'vitest'
import type { Booking, BookingInput } from '@/domain/booking'
import { TITLE_MAX_LENGTH } from '@/domain/booking'
import {
  canCreateOnDate,
  findConflict,
  isBookingEditable,
  overlapMessage,
  overlaps,
  validateBooking,
  VALIDATION_MESSAGES,
  type ValidationIssue,
} from '@/domain/rules'

// Local-time constructor: timezone-independent. "Now" is 2026-10-27 12:07.
const NOW = new Date(2026, 9, 27, 12, 7)
const TODAY = '2026-10-27'
const TOMORROW = '2026-10-28'
const YESTERDAY = '2026-10-26'

const input = (start: string, end: string, extra: Partial<BookingInput> = {}): BookingInput => ({
  date: TOMORROW,
  start,
  end,
  ...extra,
})

const booking = (
  id: string,
  start: string,
  end: string,
  extra: Partial<Booking> = {},
): Booking => ({
  id,
  date: TOMORROW,
  start,
  end,
  ...extra,
})

const validate = (value: BookingInput, existing: Booking[] = [], excludeId?: string) =>
  validateBooking(value, existing, { now: NOW, excludeId })

/** Compact `CODE:field` view for order-sensitive assertions. */
const summary = (issues: ValidationIssue[]) => issues.map((i) => `${i.code}:${i.field}`)

describe('overlaps', () => {
  const r = (start: string, end: string) => ({ start, end })

  it('touching boundaries do not overlap (both directions)', () => {
    expect(overlaps(r('10:00', '11:00'), r('11:00', '12:00'))).toBe(false)
    expect(overlaps(r('11:00', '12:00'), r('10:00', '11:00'))).toBe(false)
  })

  it('disjoint ranges do not overlap', () => {
    expect(overlaps(r('09:00', '10:00'), r('11:00', '12:00'))).toBe(false)
  })

  it('partial overlap', () => {
    expect(overlaps(r('10:00', '11:00'), r('10:30', '11:30'))).toBe(true)
    expect(overlaps(r('10:30', '11:30'), r('10:00', '11:00'))).toBe(true)
  })

  it('containment both ways', () => {
    expect(overlaps(r('10:00', '12:00'), r('10:30', '11:00'))).toBe(true)
    expect(overlaps(r('10:30', '11:00'), r('10:00', '12:00'))).toBe(true)
  })

  it('identical range', () => {
    expect(overlaps(r('10:00', '11:00'), r('10:00', '11:00'))).toBe(true)
  })

  it('one-minute overlap', () => {
    expect(overlaps(r('10:00', '11:01'), r('11:00', '12:00'))).toBe(true)
  })
})

describe('findConflict', () => {
  it('ignores bookings on other dates', () => {
    const other = booking('a', '10:00', '11:00', { date: TODAY })
    expect(findConflict(input('10:00', '11:00'), [other])).toBeUndefined()
  })

  it('skips the excluded booking', () => {
    const self = booking('a', '10:00', '11:00')
    expect(findConflict(input('10:00', '11:00'), [self], 'a')).toBeUndefined()
    expect(findConflict(input('10:00', '11:00'), [self], 'b')).toBe(self)
  })

  it('returns the earliest conflict regardless of input order', () => {
    const late = booking('late', '11:00', '12:00')
    const early = booking('early', '10:00', '10:45')
    expect(findConflict(input('10:30', '11:30'), [late, early])).toBe(early)
    expect(findConflict(input('10:30', '11:30'), [early, late])).toBe(early)
  })
})

describe('validateBooking: valid input', () => {
  it('returns no issues for a correct booking on a free future day', () => {
    expect(validate(input('10:00', '11:00', { title: 'Планёрка' }))).toEqual([])
  })

  it('accepts the whole-hours boundaries 09:00 start and 18:00 end', () => {
    expect(validate(input('09:00', '10:00'))).toEqual([])
    expect(validate(input('16:00', '18:00'))).toEqual([])
  })
})

describe('validateBooking: format', () => {
  it.each(['2026-02-30', '2026-13-01', '28.10.2026', ''])('INVALID_DATE for %j', (date) => {
    expect(summary(validate(input('10:00', '11:00', { date })))).toEqual(['INVALID_DATE:date'])
  })

  it.each(['9:00', '24:00', '12:60', '10:00:00', ''])('INVALID_TIME for start %j', (start) => {
    expect(summary(validate(input(start, '11:00')))).toEqual(['INVALID_TIME:start'])
  })

  it('INVALID_TIME for end', () => {
    expect(summary(validate(input('10:00', '11:5')))).toEqual(['INVALID_TIME:end'])
  })

  it('reports all format issues together in date/start/end order', () => {
    expect(summary(validate({ date: 'x', start: 'y', end: 'z' }))).toEqual([
      'INVALID_DATE:date',
      'INVALID_TIME:start',
      'INVALID_TIME:end',
    ])
  })

  it('short-circuits range, past and overlap rules', () => {
    // Past date, outside working hours, too long and overlapping: only the format issue is shown.
    const existing = [booking('a', '08:00', '12:00', { date: YESTERDAY })]
    const issues = validate({ date: YESTERDAY, start: '08:00', end: '25:00' }, existing)
    expect(summary(issues)).toEqual(['INVALID_TIME:end'])
  })

  it('still reports TITLE_TOO_LONG alongside format issues', () => {
    const issues = validate(input('9:00', '11:00', { title: 'x'.repeat(TITLE_MAX_LENGTH + 1) }))
    expect(summary(issues)).toEqual(['INVALID_TIME:start', 'TITLE_TOO_LONG:title'])
  })

  it('uses the Russian message', () => {
    expect(validate(input('10:00', '11:00', { date: 'bad' }))[0]?.message).toBe(
      VALIDATION_MESSAGES.INVALID_DATE,
    )
  })
})

describe('validateBooking: title', () => {
  it('accepts a title of exactly TITLE_MAX_LENGTH characters', () => {
    expect(validate(input('10:00', '11:00', { title: 'x'.repeat(TITLE_MAX_LENGTH) }))).toEqual([])
  })

  it('rejects a title longer than TITLE_MAX_LENGTH', () => {
    const issues = validate(input('10:00', '11:00', { title: 'x'.repeat(TITLE_MAX_LENGTH + 1) }))
    expect(summary(issues)).toEqual(['TITLE_TOO_LONG:title'])
  })

  it('measures the trimmed title', () => {
    const title = `  ${'x'.repeat(TITLE_MAX_LENGTH)}   `
    expect(validate(input('10:00', '11:00', { title }))).toEqual([])
  })

  it('accepts a missing or empty title', () => {
    expect(validate(input('10:00', '11:00', { title: '' }))).toEqual([])
    expect(validate(input('10:00', '11:00', { title: undefined }))).toEqual([])
  })
})

describe('validateBooking: working hours (rule 1)', () => {
  it('rejects start before 09:00', () => {
    const issues = validate(input('08:45', '09:30'))
    expect(summary(issues)).toEqual(['OUTSIDE_WORKING_HOURS:start'])
    expect(issues[0]?.message).toBe('Время должно быть в пределах рабочего дня 09:00–18:00')
  })

  it('rejects end after 18:00', () => {
    expect(summary(validate(input('17:30', '18:15')))).toEqual(['OUTSIDE_WORKING_HOURS:end'])
  })

  it('reports both sides when both are outside', () => {
    expect(summary(validate(input('08:00', '19:00')))).toEqual([
      'OUTSIDE_WORKING_HOURS:start',
      'OUTSIDE_WORKING_HOURS:end',
      'TOO_LONG:end',
    ])
  })

  it('08:59 is outside, 18:01 is outside', () => {
    expect(summary(validate(input('08:59', '10:00')))).toEqual(['OUTSIDE_WORKING_HOURS:start'])
    expect(summary(validate(input('17:00', '18:01')))).toEqual(['OUTSIDE_WORKING_HOURS:end'])
  })
})

describe('validateBooking: start before end (rule 2)', () => {
  it('rejects start == end and skips duration rules', () => {
    const issues = validate(input('10:00', '10:00'))
    expect(summary(issues)).toEqual(['START_NOT_BEFORE_END:end'])
  })

  it('rejects start > end and skips duration rules', () => {
    expect(summary(validate(input('12:00', '10:00')))).toEqual(['START_NOT_BEFORE_END:end'])
  })
})

describe('validateBooking: duration (rules 3–4)', () => {
  it('29 minutes is too short', () => {
    const issues = validate(input('10:00', '10:29'))
    expect(summary(issues)).toEqual(['TOO_SHORT:end'])
    expect(issues[0]?.message).toBe(VALIDATION_MESSAGES.TOO_SHORT)
  })

  it('exactly 30 minutes is valid', () => {
    expect(validate(input('10:00', '10:30'))).toEqual([])
  })

  it('exactly 120 minutes is valid', () => {
    expect(validate(input('10:00', '12:00'))).toEqual([])
  })

  it('121 minutes is too long', () => {
    expect(summary(validate(input('10:00', '12:01')))).toEqual(['TOO_LONG:end'])
  })
})

describe('validateBooking: past (rule 6)', () => {
  it('rejects a past date with PAST_DATE only (no PAST_TIME)', () => {
    const issues = validate(input('10:00', '11:00', { date: YESTERDAY }))
    expect(summary(issues)).toEqual(['PAST_DATE:date'])
    expect(issues[0]?.message).toBe('Нельзя бронировать на прошедшую дату')
  })

  it('rejects a past start time today', () => {
    expect(summary(validate(input('12:00', '13:00', { date: TODAY })))).toEqual(['PAST_TIME:start'])
    expect(summary(validate(input('12:06', '13:00', { date: TODAY })))).toEqual(['PAST_TIME:start'])
  })

  it('rejects the current minute: it has already started (consistent with isBookingEditable)', () => {
    expect(summary(validate(input('12:07', '13:00', { date: TODAY })))).toEqual(['PAST_TIME:start'])
    const atMinuteStart = new Date(2026, 9, 27, 12, 7, 0)
    expect(
      summary(
        validateBooking(input('12:07', '13:00', { date: TODAY }), [], { now: atMinuteStart }),
      ),
    ).toEqual(['PAST_TIME:start'])
  })

  it('allows the next minute and later times today', () => {
    expect(validate(input('12:08', '13:00', { date: TODAY }))).toEqual([])
    expect(validate(input('12:15', '13:00', { date: TODAY }))).toEqual([])
  })

  it('allows any time on a future date', () => {
    expect(validate(input('09:00', '09:30', { date: TOMORROW }))).toEqual([])
  })

  it('combines several non-format issues in deterministic order', () => {
    // Today, start in the past and before 09:00, end after 18:00, too long, long title.
    const issues = validate(
      input('08:00', '18:30', { date: TODAY, title: 'x'.repeat(TITLE_MAX_LENGTH + 1) }),
    )
    expect(summary(issues)).toEqual([
      'OUTSIDE_WORKING_HOURS:start',
      'PAST_TIME:start',
      'OUTSIDE_WORKING_HOURS:end',
      'TOO_LONG:end',
      'TITLE_TOO_LONG:title',
    ])
  })

  it('puts date issues before start/end issues', () => {
    expect(summary(validate(input('08:00', '08:10', { date: YESTERDAY })))).toEqual([
      'PAST_DATE:date',
      'OUTSIDE_WORKING_HOURS:start',
      'TOO_SHORT:end',
    ])
  })
})

describe('validateBooking: overlap (rules 5, 7)', () => {
  const planning = booking('p', '10:00', '11:00', { title: 'Планёрка' })

  it('touching bookings 10–11 and 11–12 are fine', () => {
    expect(validate(input('11:00', '12:00'), [planning])).toEqual([])
    expect(validate(input('09:00', '10:00'), [planning])).toEqual([])
  })

  it.each([
    ['partial overlap at start', '09:30', '10:30'],
    ['partial overlap at end', '10:30', '11:30'],
    ['input contains existing', '09:30', '11:30'],
    ['existing contains input', '10:15', '10:45'],
    ['identical range', '10:00', '11:00'],
  ])('%s → OVERLAP', (_name, start, end) => {
    const issues = validate(input(start, end), [planning])
    expect(issues).toEqual([
      {
        code: 'OVERLAP',
        field: 'start',
        message: 'Время пересекается с бронью 10:00–11:00 «Планёрка»',
        conflictingBooking: planning,
      },
    ])
  })

  it('omits the title part of the message when the booking has no title', () => {
    const untitled = booking('u', '10:00', '11:00')
    expect(validate(input('10:30', '11:30'), [untitled])[0]?.message).toBe(
      'Время пересекается с бронью 10:00–11:00',
    )
    expect(overlapMessage({ ...untitled, title: '   ' })).toBe(
      'Время пересекается с бронью 10:00–11:00',
    )
  })

  it('ignores bookings on other dates', () => {
    const otherDay = { ...planning, date: TODAY }
    expect(validate(input('10:00', '11:00'), [otherDay])).toEqual([])
  })

  it('editing a booking does not conflict with itself (excludeId)', () => {
    expect(validate(input('10:30', '11:30'), [planning], 'p')).toEqual([])
  })

  it('editing still fails when overlapping another booking', () => {
    const other = booking('o', '11:00', '12:00', { title: 'Демо' })
    const issues = validate(input('10:30', '11:30'), [planning, other], 'p')
    expect(summary(issues)).toEqual(['OVERLAP:start'])
    expect(issues[0]?.conflictingBooking).toBe(other)
  })

  it('is reported only when all other rules pass', () => {
    // Overlaps planning but is also too short: only TOO_SHORT.
    expect(summary(validate(input('10:00', '10:15'), [planning]))).toEqual(['TOO_SHORT:end'])
  })
})

describe('canCreateOnDate', () => {
  it('allows today and future, forbids past', () => {
    expect(canCreateOnDate(YESTERDAY, NOW)).toBe(false)
    expect(canCreateOnDate(TODAY, NOW)).toBe(true)
    expect(canCreateOnDate(TOMORROW, NOW)).toBe(true)
  })

  it('allows today even late in the evening', () => {
    expect(canCreateOnDate(TODAY, new Date(2026, 9, 27, 23, 59))).toBe(true)
  })
})

describe('isBookingEditable (rule 8)', () => {
  it('past date booking is read-only', () => {
    expect(isBookingEditable(booking('a', '17:00', '18:00', { date: YESTERDAY }), NOW)).toBe(false)
  })

  it('future date booking is editable', () => {
    expect(isBookingEditable(booking('a', '09:00', '10:00', { date: TOMORROW }), NOW)).toBe(true)
  })

  it('today: started or finished bookings are read-only', () => {
    expect(isBookingEditable(booking('a', '09:00', '10:00', { date: TODAY }), NOW)).toBe(false)
    expect(isBookingEditable(booking('a', '12:00', '13:00', { date: TODAY }), NOW)).toBe(false)
  })

  it('today: a booking starting exactly now is already started', () => {
    expect(isBookingEditable(booking('a', '12:07', '13:00', { date: TODAY }), NOW)).toBe(false)
  })

  it('today: a booking starting later is editable', () => {
    expect(isBookingEditable(booking('a', '12:08', '13:00', { date: TODAY }), NOW)).toBe(true)
    expect(isBookingEditable(booking('a', '15:00', '16:00', { date: TODAY }), NOW)).toBe(true)
  })
})
