import type { FieldErrors, Resolver } from 'react-hook-form'
import { z } from 'zod'
import { TITLE_MAX_LENGTH, type Booking, type BookingInput } from '@/domain/booking'
import { VALIDATION_MESSAGES, validateBooking, type ValidationIssue } from '@/domain/rules'

/**
 * Form values are plain strings (`date: YYYY-MM-DD`, `start/end: HH:mm`); pickers convert
 * to/from dayjs at their boundary. An empty string means "not filled", `INVALID_INPUT` means
 * "something was typed but it is not a complete/valid date or time".
 */
export type BookingFormValues = {
  date: string
  start: string
  end: string
  title: string
}

export type BookingFormField = keyof BookingFormValues

export const INVALID_INPUT = 'invalid'

/** Shape only: required fields and title normalization. Business rules live in the domain. */
export const bookingFormSchema = z.object({
  date: z.string().min(1, 'Укажите дату'),
  start: z.string().min(1, 'Укажите время начала'),
  end: z.string().min(1, 'Укажите время окончания'),
  title: z.string().trim().max(TITLE_MAX_LENGTH, VALIDATION_MESSAGES.TITLE_TOO_LONG),
})

export type BookingFieldErrors = Partial<
  Record<BookingFormField, { type: string; message: string }>
>

const FIELDS: readonly BookingFormField[] = ['date', 'start', 'end', 'title']

const isFormField = (value: unknown): value is BookingFormField =>
  FIELDS.includes(value as BookingFormField)

/**
 * Maps domain/server issues to form fields; the first issue per field wins (the domain
 * returns them in a meaningful order). `OVERLAP` is shown on `start`. Issues with an unknown
 * field (e.g. from a different server version) are dropped.
 */
export function toFieldErrors(
  issues: readonly Pick<ValidationIssue, 'code' | 'field' | 'message'>[],
): BookingFieldErrors {
  const errors: BookingFieldErrors = {}
  for (const issue of issues) {
    const field = issue.code === 'OVERLAP' ? 'start' : issue.field
    if (!isFormField(field) || errors[field]) continue
    errors[field] = { type: issue.code, message: issue.message }
  }
  return errors
}

/** Form values (already shape-checked) -> domain input. Empty title is omitted. */
export function toBookingInput(values: BookingFormValues): BookingInput {
  const title = values.title.trim()
  return {
    date: values.date,
    start: values.start,
    end: values.end,
    ...(title ? { title } : {}),
  }
}

export type BookingFormContext = {
  /** Bookings known for the form's date (may be empty/stale while loading: server re-checks). */
  existing: readonly Booking[]
  /** Booking being edited, so it does not conflict with itself. */
  excludeId?: string
  /** Injected clock for tests; defaults to `new Date()` at validation time. */
  now?: () => Date
}

export type BookingFormValidation =
  { ok: true; values: BookingFormValues } | { ok: false; errors: BookingFieldErrors }

/** zod for shape, then the domain's `validateBooking` as the single source of business rules. */
export function validateBookingForm(
  raw: BookingFormValues,
  context: BookingFormContext,
): BookingFormValidation {
  const parsed = bookingFormSchema.safeParse(raw)
  if (!parsed.success) {
    const errors: BookingFieldErrors = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]
      if (isFormField(field) && !errors[field]) {
        errors[field] = { type: 'SHAPE', message: issue.message }
      }
    }
    return { ok: false, errors }
  }

  const values = parsed.data
  const issues = validateBooking(toBookingInput(values), context.existing, {
    now: context.now?.() ?? new Date(),
    excludeId: context.excludeId,
  })
  if (issues.length > 0) return { ok: false, errors: toFieldErrors(issues) }
  return { ok: true, values }
}

/** react-hook-form resolver; current bookings/excludeId come via `useForm({ context })`. */
export const bookingFormResolver: Resolver<BookingFormValues, BookingFormContext> = (
  values,
  context,
) => {
  const result = validateBookingForm(values, context ?? { existing: [] })
  if (result.ok) return { values: result.values, errors: {} }
  return { values: {}, errors: result.errors as FieldErrors<BookingFormValues> }
}
