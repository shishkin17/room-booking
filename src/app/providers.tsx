import type { ReactNode } from 'react'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import 'dayjs/locale/ru'
import type { BookingsApi } from '@/api/bookingsApi'
import { BookingsApiProvider } from '@/api/BookingsApiProvider'
import { theme } from './theme'

// Factory is exported for tests (fresh client per test).
// eslint-disable-next-line react-refresh/only-export-components
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 10_000 },
      mutations: { retry: 0 },
    },
  })
}

const queryClient = createQueryClient()

export function Providers({
  children,
  client = queryClient,
  api,
}: {
  children: ReactNode
  client?: QueryClient
  /** Override the network layer (tests, or a real backend adapter). */
  api?: BookingsApi
}) {
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ru">
          <BookingsApiProvider api={api}>{children}</BookingsApiProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
