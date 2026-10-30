import { useEffect, useRef } from 'react'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { Booking } from '@/domain/booking'
import { formatTimeRange, minutesOfDay, toIsoDate, toMinutes } from '@/domain/time'

export type BookingCardProps = {
  booking: Booking
  isPast: boolean
  now: Date
  highlighted?: boolean
  onEdit: (booking: Booking) => void
  onDelete: (booking: Booking) => void
}

function pastLabel(booking: Booking, now: Date): string {
  const finished =
    booking.date < toIsoDate(now) ||
    (booking.date === toIsoDate(now) && toMinutes(booking.end) <= minutesOfDay(now))
  return finished ? 'Прошла' : 'Идёт'
}

export function BookingCard({
  booking,
  isPast,
  now,
  highlighted,
  onEdit,
  onDelete,
}: BookingCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView?.({ block: 'nearest' })
  }, [highlighted])

  const range = formatTimeRange(booking)
  return (
    <Paper
      ref={ref}
      variant="outlined"
      sx={{
        p: 1.5,
        width: '100%',
        borderColor: highlighted ? 'error.main' : undefined,
        borderWidth: highlighted ? 2 : 1,
        bgcolor: isPast ? 'action.hover' : 'background.paper',
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Stack sx={{ flex: 1, minWidth: 0 }} spacing={0.5}>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexWrap: 'wrap', alignItems: 'center' }}
          >
            <Typography component="span" sx={{ fontWeight: 600 }}>
              {range}
            </Typography>
            {isPast && <Chip size="small" label={pastLabel(booking, now)} />}
            {highlighted && <Chip size="small" color="error" label="Конфликт" />}
          </Stack>
          <Typography noWrap color={booking.title ? 'text.primary' : 'text.secondary'}>
            {booking.title || 'Без названия'}
          </Typography>
        </Stack>
        <IconButton
          aria-label={`Изменить бронь ${range}`}
          disabled={isPast}
          onClick={() => onEdit(booking)}
        >
          <EditIcon />
        </IconButton>
        <IconButton
          aria-label={`Удалить бронь ${range}`}
          disabled={isPast}
          onClick={() => onDelete(booking)}
        >
          <DeleteIcon />
        </IconButton>
      </Stack>
    </Paper>
  )
}
