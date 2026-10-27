import { useCallback, useEffect, useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { MIN_DURATION_MINUTES, type Booking, type TimeRange } from '@/domain/booking'
import { canCreateOnDate } from '@/domain/rules'
import { buildDaySchedule, type ScheduleItem } from '@/domain/schedule'
import { durationMinutes } from '@/domain/time'
import { BookingFormDialog } from '@/features/bookings/components/BookingFormDialog'
import { DAY_HEADING_ID, DateToolbar } from '@/features/bookings/components/DateToolbar'
import { DayTimeline } from '@/features/bookings/components/DayTimeline'
import { DeleteBookingDialog } from '@/features/bookings/components/DeleteBookingDialog'
import {
  ErrorState,
  RefreshIndicator,
  ScheduleSkeleton,
} from '@/features/bookings/components/ScheduleStates'
import { useBookings } from '@/features/bookings/queries'
import { useSelectedDate } from '@/features/bookings/useSelectedDate'
import { useNow } from '@/shared/useNow'

type FormState = { open: boolean; booking?: Booking; initialRange?: TimeRange }

const HIGHLIGHT_MS = 8000

/**
 * After create/delete the element that opened the dialog (a free slot, a card) is gone, so MUI
 * cannot restore focus to it. Move focus to the day heading instead of dropping it on <body>.
 */
function keepFocusInPage() {
  requestAnimationFrame(() => {
    const active = document.activeElement
    if (!active || active === document.body || !active.isConnected) {
      document.getElementById(DAY_HEADING_ID)?.focus()
    }
  })
}

export function App() {
  const now = useNow()
  const [date, setSelectedDate] = useSelectedDate()
  const query = useBookings(date)
  const [form, setForm] = useState<FormState>({ open: false })
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null)
  // An object, so re-setting the same id restarts the auto-clear timer.
  const [highlight, setHighlight] = useState<{ id: string } | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const setDate = (next: string) => {
    setHighlight(null)
    setSelectedDate(next)
  }

  const bookings = query.data
  const isPastDay = !canCreateOnDate(date, now)
  const schedule = buildDaySchedule(date, bookings ?? [], now)
  const freeNow = schedule.filter(
    (item): item is Extract<ScheduleItem, { kind: 'free' }> => item.kind === 'free' && !item.isPast,
  )
  const canCreate =
    !isPastDay && freeNow.some((item) => durationMinutes(item) >= MIN_DURATION_MINUTES)
  const wholeDayFree = schedule.length === 1 && freeNow.length === 1
  const createHint = isPastDay
    ? 'Нельзя создавать брони на прошедшие даты'
    : 'На этот день свободного времени не осталось'

  useEffect(() => {
    if (!highlight) return
    const id = window.setTimeout(() => setHighlight(null), HIGHLIGHT_MS)
    return () => window.clearTimeout(id)
  }, [highlight])

  // Keep the conflict highlight a bit after the dialog closes: on mobile the full-screen dialog
  // covered the list, so this is the first moment the user can actually see it.
  const closeForm = useCallback(() => {
    setForm((prev) => ({ ...prev, open: false }))
    setHighlight((prev) => prev && { ...prev })
  }, [])

  const handleSaved = (booking: Booking, mode: 'create' | 'edit') => {
    setForm((prev) => ({ ...prev, open: false }))
    setHighlight(null)
    setMessage(mode === 'create' ? 'Бронь создана' : 'Бронь обновлена')
    if (booking.date !== date) setDate(booking.date)
    keepFocusInPage()
  }

  const handleDeleted = (_booking: Booking, info: { alreadyDeleted: boolean }) => {
    setDeleteTarget(null)
    setMessage(info.alreadyDeleted ? 'Бронь уже была удалена кем-то другим' : 'Бронь удалена')
    keepFocusInPage()
  }

  const retry = () => void query.refetch()
  let content
  if (bookings) {
    content = (
      <>
        {query.isError && <ErrorState stale error={query.error} onRetry={retry} />}
        {isPastDay && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Прошедшая дата — доступен только просмотр
          </Alert>
        )}
        {bookings.length === 0 && (
          <Typography sx={{ mb: 2 }}>
            На эту дату броней нет{wholeDayFree ? ' — весь день свободен' : ''}
          </Typography>
        )}
        <DayTimeline
          date={date}
          bookings={bookings}
          now={now}
          highlightedId={highlight?.id ?? null}
          onCreate={(range) => setForm({ open: true, initialRange: range })}
          onEdit={(booking) => setForm({ open: true, booking })}
          onDelete={setDeleteTarget}
        />
      </>
    )
  } else if (query.isError) {
    content = <ErrorState error={query.error} onRetry={retry} retrying={query.isFetching} />
  } else {
    content = <ScheduleSkeleton />
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
      <Stack spacing={3}>
        <Box component="header">
          <Typography variant="h1" sx={{ fontSize: { xs: '1.6rem', sm: '2rem' } }}>
            Бронирование переговорной
          </Typography>
          <Typography color="text.secondary">
            Рабочий день 09:00–18:00, бронь от 30 минут до 2 часов
          </Typography>
        </Box>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}
        >
          <DateToolbar date={date} now={now} onChange={setDate} />
          <Box>
            <Button
              variant="contained"
              fullWidth
              startIcon={<AddIcon />}
              disabled={!canCreate}
              aria-describedby={canCreate ? undefined : 'create-hint'}
              onClick={() => setForm({ open: true })}
            >
              Новая бронь
            </Button>
            {!canCreate && (
              <Typography id="create-hint" variant="caption" color="text.secondary">
                {createHint}
              </Typography>
            )}
          </Box>
        </Stack>

        <Box component="main" sx={{ position: 'relative', pt: 1 }}>
          {query.isFetching && bookings && <RefreshIndicator />}
          {content}
        </Box>
      </Stack>

      <BookingFormDialog
        open={form.open}
        date={date}
        booking={form.booking}
        initialRange={form.initialRange}
        onClose={closeForm}
        onSaved={handleSaved}
        onConflict={(conflicting) => setHighlight({ id: conflicting.id })}
      />
      <DeleteBookingDialog
        booking={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleDeleted}
      />
      <Snackbar
        open={message !== null}
        autoHideDuration={4000}
        onClose={(_, reason) => reason !== 'clickaway' && setMessage(null)}
        message={message}
        slotProps={{ content: { role: 'status' } }}
      />
    </Container>
  )
}
