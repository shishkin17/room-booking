/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react'
import type { BookingsApi } from './bookingsApi'
import { bookingsApi as defaultApi } from './index'

export const BookingsApiContext = createContext<BookingsApi>(defaultApi)

export function BookingsApiProvider({
  api = defaultApi,
  children,
}: {
  api?: BookingsApi
  children: ReactNode
}) {
  return <BookingsApiContext.Provider value={api}>{children}</BookingsApiContext.Provider>
}

export function useBookingsApi(): BookingsApi {
  return useContext(BookingsApiContext)
}
