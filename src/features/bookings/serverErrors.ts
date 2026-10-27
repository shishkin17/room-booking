import { isApiError, isConflictError, isNotFoundError, isValidationError } from '@/api/errors'
import type { Booking } from '@/domain/booking'
import { formatTimeRange } from '@/domain/time'
import { toFieldErrors, type BookingFieldErrors } from './schema'

/** What the booking form should show for a failed save. */
export type SaveErrorView =
  | { kind: 'conflict'; message: string; conflictingBooking?: Booking }
  /** `message` is set only when no issue could be attached to a field. */
  | { kind: 'validation'; message: string | null; fieldErrors: BookingFieldErrors }
  | { kind: 'notFound'; message: string }
  | { kind: 'failure'; message: string }

export const CONFLICT_FIELD_MESSAGE = 'Время занято'
export const NOT_FOUND_MESSAGE = 'Эту бронь уже удалили.'
const GENERIC_SAVE_ERROR = 'Не удалось сохранить бронь. Попробуйте ещё раз.'
const GENERIC_DELETE_ERROR = 'Не удалось удалить бронь. Попробуйте ещё раз.'

export function conflictAlertMessage(conflict?: Booking): string {
  const tail = 'Список обновлён — выберите другое время.'
  if (!conflict) return `Это время только что заняли. ${tail}`
  const title = conflict.title?.trim()
  const what = `${formatTimeRange(conflict)}${title ? ` «${title}»` : ''}`
  return `Это время только что заняли: ${what}. ${tail}`
}

/**
 * `mode` matters for 404: only an edit targets an existing booking. A 404 on create means the
 * endpoint itself is missing (e.g. the request bypassed the mock), not that a booking was deleted.
 */
export function describeSaveError(error: unknown, mode: 'create' | 'edit'): SaveErrorView {
  if (isConflictError(error)) {
    const conflictingBooking = error.details?.conflictingBooking
    return {
      kind: 'conflict',
      message: conflictAlertMessage(conflictingBooking),
      conflictingBooking,
    }
  }
  if (isValidationError(error)) {
    const fieldErrors = toFieldErrors(error.details?.issues ?? [])
    const hasFieldErrors = Object.keys(fieldErrors).length > 0
    return {
      kind: 'validation',
      fieldErrors,
      message: hasFieldErrors ? null : error.message || GENERIC_SAVE_ERROR,
    }
  }
  if (isNotFoundError(error)) {
    return mode === 'edit'
      ? { kind: 'notFound', message: NOT_FOUND_MESSAGE }
      : { kind: 'failure', message: GENERIC_SAVE_ERROR }
  }
  return { kind: 'failure', message: (isApiError(error) && error.message) || GENERIC_SAVE_ERROR }
}

/** Message for a failed delete that keeps the dialog open (404 is handled as success). */
export function describeDeleteError(error: unknown): string {
  return (isApiError(error) && error.message) || GENERIC_DELETE_ERROR
}
