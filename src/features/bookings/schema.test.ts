import { describe, expect, it } from 'vitest'
import type { Booking } from '@/domain/booking'
import { VALIDATION_MESSAGES } from '@/domain/rules'
import {
  INVALID_INPUT,
  bookingFormResolver,
  toBookingInput,
  toFieldErrors,
  validateBookingForm,
  type BookingFormValues,
} from './schema'

const now = () => new Date(2026, 9, 27, 10, 7) // 27.10.2026 10:07
const existing: Booking[] = [{ id: 'b1', date: '2026-10-28', start: '10:00', end: '11:00' }]
const valid: BookingFormValues = { date: '2026-10-28', start: '11:00', end: '12:00', title: '' }

describe('toFieldErrors', () => {
  it('keeps the first issue per field and maps OVERLAP to start', () => {
    const errors = toFieldErrors([
      { code: 'OUTSIDE_WORKING_HOURS', field: 'end', message: 'a' },
      { code: 'TOO_LONG', field: 'end', message: 'b' },
      { code: 'OVERLAP', field: 'start', message: 'c' },
      { code: 'PAST_DATE', field: 'date', message: 'd' },
    ])
    expect(errors).toEqual({
      end: { type: 'OUTSIDE_WORKING_HOURS', message: 'a' },
      start: { type: 'OVERLAP', message: 'c' },
      date: { type: 'PAST_DATE', message: 'd' },
    })
  })

  it('drops issues with unknown fields', () => {
    const issues = [{ code: 'TOO_SHORT', field: 'duration', message: 'x' }] as never
    expect(toFieldErrors(issues)).toEqual({})
  })
})

describe('toBookingInput', () => {
  it('trims the title and omits it when empty', () => {
    expect(toBookingInput({ ...valid, title: '  Планёрка ' }).title).toBe('Планёрка')
    expect(toBookingInput({ ...valid, title: '   ' })).not.toHaveProperty('title')
  })
})

describe('validateBookingForm', () => {
  it('accepts a valid booking touching an existing one', () => {
    expect(validateBookingForm(valid, { existing, now })).toEqual({ ok: true, values: valid })
  })

  it('reports empty fields before running domain rules', () => {
    const result = validateBookingForm({ ...valid, start: '', date: '' }, { existing, now })
    expect(result).toEqual({
      ok: false,
      errors: {
        date: { type: 'SHAPE', message: 'Укажите дату' },
        start: { type: 'SHAPE', message: 'Укажите время начала' },
      },
    })
  })

  it('reports partially typed values as invalid format', () => {
    const result = validateBookingForm({ ...valid, end: INVALID_INPUT }, { existing, now })
    expect(result).toMatchObject({
      ok: false,
      errors: { end: { type: 'INVALID_TIME', message: VALIDATION_MESSAGES.INVALID_TIME } },
    })
  })

  it('maps domain issues to fields', () => {
    const result = validateBookingForm(
      { date: '2026-10-27', start: '09:30', end: '09:45', title: '' },
      { existing, now },
    )
    expect(result).toMatchObject({
      ok: false,
      errors: { start: { type: 'PAST_TIME' }, end: { type: 'TOO_SHORT' } },
    })
  })

  it('flags overlap on start, but not against the booking being edited', () => {
    const input = { ...valid, start: '10:30', end: '11:30' }
    expect(validateBookingForm(input, { existing, now })).toMatchObject({
      ok: false,
      errors: { start: { type: 'OVERLAP' } },
    })
    expect(validateBookingForm(input, { existing, now, excludeId: 'b1' }).ok).toBe(true)
  })

  it('rejects a past date', () => {
    const result = validateBookingForm({ ...valid, date: '2026-10-26' }, { existing, now })
    expect(result).toMatchObject({ ok: false, errors: { date: { type: 'PAST_DATE' } } })
  })
})

describe('bookingFormResolver', () => {
  const options = { fields: {}, shouldUseNativeValidation: false }

  it('returns normalized values on success', async () => {
    const result = await bookingFormResolver({ ...valid, title: ' x ' }, { existing, now }, options)
    expect(result).toEqual({ values: { ...valid, title: 'x' }, errors: {} })
  })

  it('returns field errors on failure', async () => {
    const result = await bookingFormResolver(
      { ...valid, start: '12:00', end: '11:00' },
      { existing, now },
      options,
    )
    expect(result.values).toEqual({})
    expect(result.errors).toHaveProperty('end.type', 'START_NOT_BEFORE_END')
  })
})
