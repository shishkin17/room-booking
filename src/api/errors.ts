import type { Booking } from '@/domain/booking'
import type { ValidationIssue } from '@/domain/rules'

export type ApiErrorCode = 'VALIDATION' | 'CONFLICT' | 'NOT_FOUND' | 'INTERNAL' | 'NETWORK'

/** JSON body of every non-2xx response. */
export type ApiErrorBody = {
  code: ApiErrorCode
  message: string
  details?: {
    /** For 422 VALIDATION. */
    issues?: ValidationIssue[]
    /** For 409 CONFLICT. */
    conflictingBooking?: Booking
  }
}

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly details: ApiErrorBody['details']

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.details = body.details
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError

export const isConflictError = (error: unknown): error is ApiError =>
  isApiError(error) && error.code === 'CONFLICT'

export const isNotFoundError = (error: unknown): error is ApiError =>
  isApiError(error) && error.code === 'NOT_FOUND'

export const isValidationError = (error: unknown): error is ApiError =>
  isApiError(error) && error.code === 'VALIDATION'
