import ButtonBase from '@mui/material/ButtonBase'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Typography from '@mui/material/Typography'
import dayjs from 'dayjs'
import { MIN_DURATION_MINUTES, type Booking, type IsoDate, type TimeRange } from '@/domain/booking'
import { buildDaySchedule } from '@/domain/schedule'
import { durationMinutes, formatTimeRange, fromMinutes, toMinutes } from '@/domain/time'
import { BookingCard } from '@/features/bookings/components/BookingCard'

export type DayTimelineProps = {
  date: IsoDate
  bookings: readonly Booking[]
  now: Date
  highlightedId?: string | null
  onCreate: (range: TimeRange) => void
  onEdit: (booking: Booking) => void
  onDelete: (booking: Booking) => void
}

const DEFAULT_SLOT_MINUTES = 60

function FreeSlot({
  range,
  isPast,
  onCreate,
}: {
  range: TimeRange
  isPast: boolean
  onCreate: (range: TimeRange) => void
}) {
  const minutes = durationMinutes(range)
  const reason = isPast ? 'Прошло' : minutes < MIN_DURATION_MINUTES ? 'Меньше 30 минут' : null
  const text = formatTimeRange(range)
  return (
    <ButtonBase
      disabled={reason !== null}
      aria-label={
        reason ? `Свободно ${text}, ${reason.toLowerCase()}` : `Свободно ${text}, забронировать`
      }
      onClick={() =>
        onCreate({
          start: range.start,
          end: fromMinutes(
            Math.min(toMinutes(range.end), toMinutes(range.start) + DEFAULT_SLOT_MINUTES),
          ),
        })
      }
      sx={{
        width: '100%',
        justifyContent: 'space-between',
        gap: 1,
        px: 1.5,
        py: 1,
        minHeight: Math.min(96, Math.max(48, minutes * 0.6)),
        border: '1px dashed',
        borderColor: reason ? 'divider' : 'primary.main',
        borderRadius: 1,
        color: reason ? 'text.disabled' : 'primary.main',
        textAlign: 'left',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Typography component="span">Свободно {text}</Typography>
      <Typography component="span" variant="body2">
        {reason ?? 'Забронировать'}
      </Typography>
    </ButtonBase>
  )
}

export function DayTimeline({
  date,
  bookings,
  now,
  highlightedId,
  onCreate,
  onEdit,
  onDelete,
}: DayTimelineProps) {
  const items = buildDaySchedule(date, bookings, now)
  const label = `Расписание на ${dayjs(date).locale('ru').format('D MMMM')}`
  return (
    <List
      aria-label={label}
      disablePadding
      sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1 }}
    >
      {items.map((item) => (
        <ListItem
          key={item.kind === 'booking' ? item.booking.id : `free-${item.start}`}
          disablePadding
        >
          {item.kind === 'booking' ? (
            <BookingCard
              booking={item.booking}
              isPast={item.isPast}
              now={now}
              highlighted={item.booking.id === highlightedId}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ) : (
            <FreeSlot range={item} isPast={item.isPast} onCreate={onCreate} />
          )}
        </ListItem>
      ))}
    </List>
  )
}
