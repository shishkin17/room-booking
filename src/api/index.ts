import { createHttpBookingsApi } from './httpBookingsApi'

export const bookingsApi = createHttpBookingsApi()
export { createHttpBookingsApi } from './httpBookingsApi'
export type { BookingsApi } from './bookingsApi'
export * from './errors'
