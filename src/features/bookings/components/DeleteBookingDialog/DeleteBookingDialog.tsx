import { useId, useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import { isNotFoundError } from '@/api/errors'
import type { Booking } from '@/domain/booking'
import { formatTimeRange } from '@/domain/time'
import { useDeleteBooking } from '@/features/bookings/queries'
import { describeDeleteError } from '@/features/bookings/serverErrors'

export type DeleteBookingDialogProps = {
  /** Booking to delete; dialog is open while it is set. */
  booking: Booking | null
  onClose: () => void
  /** `alreadyDeleted`: server answered 404 (someone else removed it); the list is refreshed either way. */
  onDeleted: (booking: Booking, info: { alreadyDeleted: boolean }) => void
}

const dayMonthFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })

/** `«Удалить бронь 10:00–11:00 «Планёрка» на 27 октября?»` */
function confirmationText(booking: Booking): string {
  const [year, month, day] = booking.date.split('-').map(Number)
  const dateLabel = dayMonthFormat.format(new Date(year ?? 0, (month ?? 1) - 1, day ?? 1))
  const title = booking.title?.trim()
  return `Удалить бронь ${formatTimeRange(booking)}${title ? ` «${title}»` : ''} на ${dateLabel}?`
}

export function DeleteBookingDialog({ booking, onClose, onDeleted }: DeleteBookingDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const deleteMutation = useDeleteBooking()
  const pending = deleteMutation.isPending
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Keep the last booking so the text does not disappear during the closing transition.
  const [shown, setShown] = useState(booking)
  if (booking && booking !== shown) {
    setShown(booking)
    setErrorMessage(null)
  }
  const current = booking ?? shown

  const close = () => {
    if (pending) return
    setErrorMessage(null)
    onClose()
  }

  const handleDelete = async () => {
    if (!current || pending) return
    setErrorMessage(null)
    try {
      await deleteMutation.mutateAsync({ id: current.id, date: current.date })
      onDeleted(current, { alreadyDeleted: false })
      onClose()
    } catch (error) {
      if (isNotFoundError(error)) {
        onDeleted(current, { alreadyDeleted: true })
        onClose()
        return
      }
      setErrorMessage(describeDeleteError(error))
    }
  }

  return (
    <Dialog
      open={booking !== null}
      onClose={close}
      disableEscapeKeyDown={pending}
      fullWidth
      maxWidth="xs"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <DialogTitle id={titleId}>Удалить бронь?</DialogTitle>
      <DialogContent>
        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}
        <DialogContentText id={descriptionId}>
          {current ? confirmationText(current) : null}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close} disabled={pending} autoFocus>
          Отмена
        </Button>
        <Button
          variant="contained"
          color="error"
          loading={pending}
          onClick={() => void handleDelete()}
        >
          Удалить
        </Button>
      </DialogActions>
    </Dialog>
  )
}
