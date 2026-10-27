import dayjs, { type Dayjs } from 'dayjs'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import type { IsoDate } from '@/domain/booking'
import { isToday, toIsoDate } from '@/domain/time'

export type DateToolbarProps = {
  date: IsoDate
  now: Date
  onChange: (date: IsoDate) => void
}

export const DAY_HEADING_ID = 'day-heading'

export function DateToolbar({ date, now, onChange }: DateToolbarProps) {
  const value = dayjs(date)
  const heading = value.locale('ru').format('dddd, D MMMM')
  const shift = (days: number) => onChange(toIsoDate(value.add(days, 'day').toDate()))
  const handlePick = (picked: Dayjs | null) => {
    if (picked && picked.isValid()) onChange(toIsoDate(picked.toDate()))
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <IconButton aria-label="Предыдущий день" onClick={() => shift(-1)}>
          <ChevronLeftIcon />
        </IconButton>
        <DatePicker
          label="Дата"
          format="DD.MM.YYYY"
          value={value}
          onChange={handlePick}
          slotProps={{
            textField: { size: 'small', sx: { width: { xs: 160, sm: 180 }, flexShrink: 0 } },
          }}
        />
        <IconButton aria-label="Следующий день" onClick={() => shift(1)}>
          <ChevronRightIcon />
        </IconButton>
        <Button
          variant="outlined"
          disabled={isToday(date, now)}
          onClick={() => onChange(toIsoDate(now))}
        >
          Сегодня
        </Button>
      </Stack>
      <Typography
        id={DAY_HEADING_ID}
        tabIndex={-1}
        component="h2"
        variant="h6"
        sx={{ outline: 'none' }}
      >
        {heading.charAt(0).toUpperCase() + heading.slice(1)}
      </Typography>
    </Stack>
  )
}
