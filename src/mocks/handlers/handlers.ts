import { delay, http, HttpResponse } from 'msw'
import type { ApiErrorBody } from '@/api/errors'
import type { Booking, BookingInput, TimeRange } from '@/domain/booking'
import { fromMinutes, isValidIsoDate, toMinutes } from '@/domain/time'
import { isBookingEditable, validateBooking, type ValidationIssue } from '@/domain/rules'
import type { BookingsDb } from '@/mocks/db'
import type { DevSettingsStore } from '@/mocks/devSettings'

type Deps = { db: BookingsDb; settings: DevSettingsStore; now?: () => Date }

const error = (status: number, body: ApiErrorBody) => HttpResponse.json(body, { status })

const validation = (message: string, issues?: ValidationIssue[]) =>
  error(422, { code: 'VALIDATION', message, details: issues ? { issues } : undefined })

const notFound = () =>
  error(404, { code: 'NOT_FOUND', message: 'Бронь не найдена — возможно, её уже удалили' })

const isString = (v: unknown): v is string => typeof v === 'string'

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json()
    return typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** Returns a normalized partial; `null` when a present field has the wrong type. */
function pickFields(body: Record<string, unknown>): Partial<BookingInput> | null {
  const out: Partial<BookingInput> = {}
  for (const key of ['date', 'start', 'end'] as const) {
    if (key in body) {
      if (!isString(body[key])) return null
      out[key] = body[key]
    }
  }
  if ('title' in body && body.title !== null && body.title !== undefined) {
    if (!isString(body.title)) return null
    const title = body.title.trim()
    if (title) out.title = title
  }
  return out
}

/** Longest sub-range of `range` that does not overlap any of `bookings`. */
function longestFreePart(range: TimeRange, bookings: readonly Booking[]): TimeRange | null {
  let best: [number, number] | null = null
  let cursor = toMinutes(range.start)
  const end = toMinutes(range.end)
  const busy = bookings
    .map((b) => [toMinutes(b.start), toMinutes(b.end)] as const)
    .filter(([s, e]) => s < end && e > cursor)
    .sort((a, b) => a[0] - b[0])
  for (const [s, e] of [...busy, [end, end] as const]) {
    if (s > cursor && (!best || s - cursor > best[1] - best[0])) best = [cursor, s]
    cursor = Math.max(cursor, e)
  }
  return best && { start: fromMinutes(best[0]), end: fromMinutes(best[1]) }
}

export function createHandlers({ db, settings, now = () => new Date() }: Deps) {
  const wait = () => delay(settings.get().latencyMs)

  /**
   * Emulates another user grabbing (part of) the requested slot between the UI check and our
   * request. Only for otherwise valid input. The fake booking takes the longest part of the range
   * not occupied by anyone (when editing, that excludes the booking's own current slot) and is
   * only reported in the 409, never stored, so the demo leaves no stray bookings behind.
   */
  function simulateConcurrentBooking(input: BookingInput, excludeId?: string): Booking | null {
    if (!settings.get().simulateConflictOnce) return null
    const existing = db.listByDate(input.date)
    if (validateBooking(input, existing, { now: now(), excludeId }).length > 0) return null
    const slot = longestFreePart(input, existing)
    if (!slot) return null
    settings.set({ simulateConflictOnce: false })
    return {
      id: crypto.randomUUID(),
      date: input.date,
      ...slot,
      title: 'Забронировано другим пользователем',
    }
  }

  const conflict = (conflictingBooking?: Booking) =>
    error(409, {
      code: 'CONFLICT',
      message: 'Это время уже занято',
      details: { conflictingBooking },
    })

  function rejectIfInvalid(input: BookingInput, excludeId?: string) {
    const simulated = simulateConcurrentBooking(input, excludeId)
    if (simulated) return conflict(simulated)
    const issues = validateBooking(input, db.listByDate(input.date), {
      now: now(),
      excludeId,
    })
    if (issues.length === 0) return null
    const first = issues[0]
    if (!first) return null
    if (issues.length === 1 && first.code === 'OVERLAP') return conflict(first.conflictingBooking)
    return validation(first.message, issues)
  }

  return [
    http.get('*/api/bookings', async ({ request }) => {
      await wait()
      if (settings.get().failListRequests) {
        return error(500, { code: 'INTERNAL', message: 'Сервер временно недоступен' })
      }
      const date = new URL(request.url).searchParams.get('date')
      if (!date || !isValidIsoDate(date)) {
        return validation('Укажите дату в формате ГГГГ-ММ-ДД')
      }
      return HttpResponse.json(db.listByDate(date))
    }),

    http.post('*/api/bookings', async ({ request }) => {
      await wait()
      const body = await readBody(request)
      const fields = body && pickFields(body)
      if (!fields || !fields.date || !fields.start || !fields.end) {
        return validation('Некорректные данные брони')
      }
      const input: BookingInput = {
        date: fields.date,
        start: fields.start,
        end: fields.end,
        ...(fields.title ? { title: fields.title } : {}),
      }
      const rejection = rejectIfInvalid(input)
      if (rejection) return rejection
      return HttpResponse.json(db.insert(input), { status: 201 })
    }),

    http.patch('*/api/bookings/:id', async ({ request, params }) => {
      await wait()
      const id = String(params.id)
      const existing = db.get(id)
      if (!existing) return notFound()
      if (!isBookingEditable(existing, now())) {
        return validation('Нельзя изменить бронь, которая уже началась или прошла')
      }
      const body = await readBody(request)
      const fields = body && pickFields(body)
      if (!fields) return validation('Некорректные данные брони')
      const merged: Booking = { ...existing, ...fields }
      // An explicitly sent empty/blank title clears it.
      if (body && 'title' in body && !fields.title) delete merged.title
      const input: BookingInput = {
        date: merged.date,
        start: merged.start,
        end: merged.end,
        ...(merged.title ? { title: merged.title } : {}),
      }
      const rejection = rejectIfInvalid(input, id)
      if (rejection) return rejection
      return HttpResponse.json(db.update(id, input))
    }),

    http.delete('*/api/bookings/:id', async ({ params }) => {
      await wait()
      const id = String(params.id)
      const existing = db.get(id)
      if (!existing) return notFound()
      if (!isBookingEditable(existing, now())) {
        return validation('Нельзя удалить бронь, которая уже началась или прошла')
      }
      db.remove(id)
      return new HttpResponse(null, { status: 204 })
    }),
  ]
}
