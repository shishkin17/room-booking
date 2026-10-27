import type { Booking, BookingInput, BookingPatch, IsoDate } from '@/domain/booking'

/**
 * Network boundary. UI code depends only on this interface (via the query hooks),
 * so the mock (MSW) or a real backend can be swapped without touching components.
 * Every method rejects with `ApiError` on non-2xx responses or network failure.
 *
 * HTTP contract:
 *   GET    /api/bookings?date=YYYY-MM-DD -> 200 Booking[] (sorted by start)
 *   POST   /api/bookings      body BookingInput -> 201 Booking | 422 | 409
 *   PATCH  /api/bookings/:id  body BookingPatch -> 200 Booking | 404 | 422 | 409
 *   DELETE /api/bookings/:id                   -> 204 | 404 | 422 (already started)
 */
export interface BookingsApi {
  list(date: IsoDate, options?: { signal?: AbortSignal }): Promise<Booking[]>
  create(input: BookingInput): Promise<Booking>
  update(id: string, patch: BookingPatch): Promise<Booking>
  remove(id: string): Promise<void>
}
