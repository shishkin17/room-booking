import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/errors'
import type { Booking } from '@/domain/booking'
import { conflictAlertMessage, describeDeleteError, describeSaveError } from './serverErrors'

const conflicting: Booking = {
  id: 'x',
  date: '2026-10-28',
  start: '10:30',
  end: '11:30',
  title: 'Планёрка',
}

describe('conflictAlertMessage', () => {
  it('names the conflicting booking', () => {
    expect(conflictAlertMessage(conflicting)).toBe(
      'Это время только что заняли: 10:30–11:30 «Планёрка». Список обновлён — выберите другое время.',
    )
    expect(conflictAlertMessage({ ...conflicting, title: undefined })).toBe(
      'Это время только что заняли: 10:30–11:30. Список обновлён — выберите другое время.',
    )
  })

  it('falls back to a generic text', () => {
    expect(conflictAlertMessage()).toBe(
      'Это время только что заняли. Список обновлён — выберите другое время.',
    )
  })
})

describe('describeSaveError', () => {
  it('409 -> conflict with the booking', () => {
    const error = new ApiError(409, {
      code: 'CONFLICT',
      message: 'Это время уже занято',
      details: { conflictingBooking: conflicting },
    })
    expect(describeSaveError(error, 'edit')).toEqual({
      kind: 'conflict',
      message: conflictAlertMessage(conflicting),
      conflictingBooking: conflicting,
    })
  })

  it('422 with issues -> field errors, no alert message', () => {
    const error = new ApiError(422, {
      code: 'VALIDATION',
      message: 'Нельзя бронировать на уже прошедшее время',
      details: {
        issues: [
          {
            code: 'PAST_TIME',
            field: 'start',
            message: 'Нельзя бронировать на уже прошедшее время',
          },
        ],
      },
    })
    expect(describeSaveError(error, 'edit')).toEqual({
      kind: 'validation',
      message: null,
      fieldErrors: {
        start: { type: 'PAST_TIME', message: 'Нельзя бронировать на уже прошедшее время' },
      },
    })
  })

  it('422 without issues -> alert message', () => {
    const error = new ApiError(422, { code: 'VALIDATION', message: 'Бронь уже началась' })
    expect(describeSaveError(error, 'edit')).toEqual({
      kind: 'validation',
      message: 'Бронь уже началась',
      fieldErrors: {},
    })
  })

  it('404 on edit -> notFound', () => {
    const error = new ApiError(404, { code: 'NOT_FOUND', message: 'Бронь не найдена' })
    expect(describeSaveError(error, 'edit')).toEqual({
      kind: 'notFound',
      message: 'Эту бронь уже удалили.',
    })
  })

  it('404 on create -> generic failure, not «already deleted»', () => {
    const error = new ApiError(404, { code: 'NOT_FOUND', message: 'Not Found' })
    expect(describeSaveError(error, 'create')).toEqual({
      kind: 'failure',
      message: 'Не удалось сохранить бронь. Попробуйте ещё раз.',
    })
  })

  it('network/500/unknown -> failure with a message', () => {
    const network = new ApiError(0, { code: 'NETWORK', message: 'Нет связи' })
    expect(describeSaveError(network, 'edit')).toEqual({ kind: 'failure', message: 'Нет связи' })
    expect(describeSaveError(new Error('boom'), 'edit')).toEqual({
      kind: 'failure',
      message: 'Не удалось сохранить бронь. Попробуйте ещё раз.',
    })
  })
})

describe('describeDeleteError', () => {
  it('uses the server message or a generic one', () => {
    const error = new ApiError(422, { code: 'VALIDATION', message: 'Бронь уже началась' })
    expect(describeDeleteError(error)).toBe('Бронь уже началась')
    expect(describeDeleteError(null)).toBe('Не удалось удалить бронь. Попробуйте ещё раз.')
  })
})
