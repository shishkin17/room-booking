import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useBookingsApi } from '@/api/BookingsApiProvider'
import type { BookingInput, BookingPatch, IsoDate } from '@/domain/booking'

export const bookingKeys = {
  all: ['bookings'] as const,
  byDate: (date: IsoDate) => ['bookings', date] as const,
}

export function useBookings(date: IsoDate) {
  const api = useBookingsApi()
  return useQuery({
    queryKey: bookingKeys.byDate(date),
    queryFn: ({ signal }) => api.list(date, { signal }),
  })
}

/**
 * After a mutation the affected days are refetched. On error we wait for the refetch, so e.g. the
 * 409 message ("list updated") shows together with the fresh list; on success the dialog closes
 * right away and the list catches up in the background.
 */
function refreshAfter(queryClient: QueryClient, dates: IsoDate[], error: unknown) {
  const refetch = Promise.all(
    [...new Set(dates)].map((d) =>
      queryClient.invalidateQueries({ queryKey: bookingKeys.byDate(d) }),
    ),
  )
  return error ? refetch : undefined
}

export function useCreateBooking() {
  const api = useBookingsApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: BookingInput) => api.create(input),
    onSettled: (_data, error, input) => refreshAfter(queryClient, [input.date], error),
  })
}

export type UpdateBookingVariables = { id: string; patch: BookingPatch; previousDate: IsoDate }

export function useUpdateBooking() {
  const api = useBookingsApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: UpdateBookingVariables) => api.update(id, patch),
    onSettled: (_data, error, { patch, previousDate }) =>
      refreshAfter(queryClient, [previousDate, patch.date ?? previousDate], error),
  })
}

export type DeleteBookingVariables = { id: string; date: IsoDate }

export function useDeleteBooking() {
  const api = useBookingsApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: DeleteBookingVariables) => api.remove(id),
    onSettled: (_data, error, { date }) => refreshAfter(queryClient, [date], error),
  })
}
