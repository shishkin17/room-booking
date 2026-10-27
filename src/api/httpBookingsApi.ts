import type { BookingsApi } from './bookingsApi'
import type { Booking } from '@/domain/booking'
import { request } from './httpClient'

export function createHttpBookingsApi(): BookingsApi {
  return {
    list: (date, options) =>
      request<Booking[]>(`/api/bookings?date=${encodeURIComponent(date)}`, {
        signal: options?.signal,
      }),
    create: (input) =>
      request<Booking>('/api/bookings', { method: 'POST', body: JSON.stringify(input) }),
    update: (id, patch) =>
      request<Booking>(`/api/bookings/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    remove: (id) => request<void>(`/api/bookings/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  }
}
