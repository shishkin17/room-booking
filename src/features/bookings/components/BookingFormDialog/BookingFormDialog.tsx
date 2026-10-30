import { useId, useMemo, useState, type FormEvent } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { TimePicker } from '@mui/x-date-pickers/TimePicker'
import { useQueryClient } from '@tanstack/react-query'
import type { Dayjs } from 'dayjs'
import { Controller, useForm, type ControllerRenderProps, type FieldError } from 'react-hook-form'
import {
  TIME_STEP_MINUTES,
  TITLE_MAX_LENGTH,
  WORK_DAY_END,
  WORK_DAY_START,
  type Booking,
  type IsoDate,
  type TimeRange,
} from '@/domain/booking'
import { isValidIsoDate } from '@/domain/time'
import {
  formatDateValue,
  formatTimeValue,
  getInitialValues,
  parseDateValue,
  parseTimeValue,
} from '@/features/bookings/bookingForm'
import {
  bookingKeys,
  useBookings,
  useCreateBooking,
  useUpdateBooking,
} from '@/features/bookings/queries'
import {
  bookingFormResolver,
  toBookingInput,
  type BookingFormContext,
  type BookingFormField,
  type BookingFormValues,
} from '@/features/bookings/schema'
import {
  CONFLICT_FIELD_MESSAGE,
  describeSaveError,
  type SaveErrorView,
} from '@/features/bookings/serverErrors'

export type BookingFormDialogProps = {
  open: boolean
  /** Selected day; the form's date field starts with it. */
  date: IsoDate
  /** Present → edit mode, absent → create mode. */
  booking?: Booking
  /** Prefill for create mode (e.g. a free slot clicked in the timeline). */
  initialRange?: TimeRange
  onClose: () => void
  onSaved: (booking: Booking, mode: 'create' | 'edit') => void
  /** Server reported 409; lets the page highlight the conflicting booking. */
  onConflict?: (conflicting: Booking) => void
}

type Mode = 'create' | 'edit'

/**
 * Counts false→true transitions of `open`. Used as the form's `key`, so values are
 * initialized from props exactly once per opening (never on refetches or server errors).
 */
function useOpenSession(open: boolean): number {
  const [state, setState] = useState({ open, session: 0 })
  if (state.open !== open) {
    setState({ open, session: open ? state.session + 1 : state.session })
  }
  return state.session
}

export function BookingFormDialog({
  open,
  date,
  booking,
  initialRange,
  onClose,
  onSaved,
  onConflict,
}: BookingFormDialogProps) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const titleId = useId()
  const createMutation = useCreateBooking()
  const updateMutation = useUpdateBooking()
  const pending = createMutation.isPending || updateMutation.isPending
  const session = useOpenSession(open)

  const handleClose = () => {
    if (!pending) onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      disableEscapeKeyDown={pending}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="xs"
      aria-labelledby={titleId}
    >
      {/* Children are unmounted while closed, so every opening starts from fresh props. */}
      <BookingForm
        key={session}
        titleId={titleId}
        date={date}
        booking={booking}
        initialRange={initialRange}
        createMutation={createMutation}
        updateMutation={updateMutation}
        onClose={onClose}
        onSaved={onSaved}
        onConflict={onConflict}
      />
    </Dialog>
  )
}

type BookingFormProps = Omit<BookingFormDialogProps, 'open'> & {
  titleId: string
  createMutation: ReturnType<typeof useCreateBooking>
  updateMutation: ReturnType<typeof useUpdateBooking>
}

function BookingForm({
  titleId,
  date,
  booking,
  initialRange,
  createMutation,
  updateMutation,
  onClose,
  onSaved,
  onConflict,
}: BookingFormProps) {
  const queryClient = useQueryClient()
  // Snapshot of the props at opening time: later prop changes must not reset the form.
  const [target] = useState(booking)
  const [mode, setMode] = useState<Mode>(booking ? 'edit' : 'create')
  const [defaultValues] = useState(() =>
    getInitialValues({
      date,
      booking,
      initialRange,
      bookings: queryClient.getQueryData<Booking[]>(bookingKeys.byDate(date)) ?? [],
      now: new Date(),
    }),
  )
  const [serverError, setServerError] = useState<SaveErrorView | null>(null)

  // The date is tracked outside RHF too, to load that day's bookings for the overlap check.
  const [formDate, setFormDate] = useState(defaultValues.date)
  const bookingsQuery = useBookings(isValidIsoDate(formDate) ? formDate : date)
  // While the day is loading skip the overlap check: the server
  // re-checks anyway and answers 409.
  const existing = bookingsQuery.data ?? []
  const excludeId = mode === 'edit' ? target?.id : undefined

  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<BookingFormValues, BookingFormContext>({
    defaultValues,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    resolver: bookingFormResolver,
    context: { existing, excludeId },
  })

  const busy = isSubmitting
  const blockedByNotFound = serverError?.kind === 'notFound'

  /**
   * Editing or resubmitting hides a stale server message (except 404: editing does not bring
   * the booking back, only «Создать как новую» does).
   */
  const handleUserEdit = () => {
    setServerError((prev) => (prev?.kind === 'notFound' ? prev : null))
  }

  const applyServerError = (view: SaveErrorView) => {
    switch (view.kind) {
      case 'conflict':
        setServerError(view)
        setError('start', { type: 'CONFLICT', message: CONFLICT_FIELD_MESSAGE })
        if (view.conflictingBooking) onConflict?.(view.conflictingBooking)
        break
      case 'validation':
        setServerError(view.message ? view : null)
        for (const [field, fieldError] of Object.entries(view.fieldErrors)) {
          setError(field as BookingFormField, fieldError)
        }
        break
      default:
        setServerError(view)
    }
  }

  const save = handleSubmit(async (values) => {
    const input = toBookingInput(values)
    try {
      const saved =
        mode === 'edit' && target
          ? await updateMutation.mutateAsync({
              id: target.id,
              previousDate: target.date,
              // An empty title is sent explicitly to clear the previous one.
              patch: { ...input, title: input.title ?? '' },
            })
          : await createMutation.mutateAsync(input)
      onSaved(saved, mode)
      onClose()
    } catch (error) {
      applyServerError(describeSaveError(error, mode))
    }
  })

  const handleSubmitEvent = (event: FormEvent<HTMLFormElement>) => {
    if (busy || blockedByNotFound) {
      event.preventDefault()
      return
    }
    handleUserEdit()
    void save(event)
  }

  const switchToCreate = () => {
    setMode('create')
    setServerError(null)
  }

  return (
    <>
      <DialogTitle id={titleId}>{mode === 'edit' ? 'Изменить бронь' : 'Новая бронь'}</DialogTitle>
      <Box
        component="form"
        noValidate
        onSubmit={handleSubmitEvent}
        sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}
      >
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {serverError && serverError.message && (
              <ServerErrorAlert
                error={serverError}
                disabled={busy}
                onCreateAsNew={switchToCreate}
              />
            )}

            <Controller
              control={control}
              name="date"
              rules={{ deps: ['start', 'end'] }}
              render={({ field, fieldState }) => (
                <DateInput
                  field={field}
                  error={fieldState.error}
                  disabled={busy}
                  onValueChange={(value) => {
                    setFormDate(value)
                    handleUserEdit()
                  }}
                />
              )}
            />

            <Stack direction="row" spacing={2}>
              <Controller
                control={control}
                name="start"
                rules={{ deps: ['date', 'end'] }}
                render={({ field, fieldState }) => (
                  <TimeInput
                    label="Начало"
                    field={field}
                    error={fieldState.error}
                    disabled={busy}
                    autoFocus
                    onValueChange={handleUserEdit}
                  />
                )}
              />
              <Controller
                control={control}
                name="end"
                rules={{ deps: ['date', 'start'] }}
                render={({ field, fieldState }) => (
                  <TimeInput
                    label="Окончание"
                    field={field}
                    error={fieldState.error}
                    disabled={busy}
                    onValueChange={handleUserEdit}
                  />
                )}
              />
            </Stack>

            <Controller
              control={control}
              name="title"
              render={({ field, fieldState }) => (
                <TextField
                  label="Название"
                  placeholder="Например, планёрка"
                  name={field.name}
                  value={field.value}
                  inputRef={field.ref}
                  onBlur={field.onBlur}
                  onChange={(event) => {
                    field.onChange(event.target.value)
                    handleUserEdit()
                  }}
                  disabled={busy}
                  error={Boolean(fieldState.error)}
                  helperText={
                    fieldState.error?.message ??
                    `Необязательно · ${field.value.length}/${TITLE_MAX_LENGTH}`
                  }
                  slotProps={{ htmlInput: { maxLength: TITLE_MAX_LENGTH } }}
                  fullWidth
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button type="submit" variant="contained" loading={busy} disabled={blockedByNotFound}>
            {mode === 'edit' ? 'Сохранить' : 'Забронировать'}
          </Button>
        </DialogActions>
      </Box>
    </>
  )
}

function ServerErrorAlert({
  error,
  disabled,
  onCreateAsNew,
}: {
  error: SaveErrorView
  disabled: boolean
  onCreateAsNew: () => void
}) {
  const severity = error.kind === 'conflict' || error.kind === 'notFound' ? 'warning' : 'error'
  return (
    <Alert
      severity={severity}
      action={
        error.kind === 'notFound' ? (
          <Button color="inherit" size="small" onClick={onCreateAsNew} disabled={disabled}>
            Создать как новую
          </Button>
        ) : undefined
      }
    >
      {error.message}
    </Alert>
  )
}

/**
 * Bridges a string form value and a dayjs picker value. The picker must get back the very
 * object it emitted, otherwise a partially typed (invalid) value would be wiped on re-render.
 */
function usePickerValue(
  value: string,
  parse: (value: string) => Dayjs | null,
  format: (value: Dayjs | null) => string,
  onChange: (value: string) => void,
) {
  const parsed = useMemo(() => parse(value), [parse, value])
  const [emitted, setEmitted] = useState<{ value: string; date: Dayjs | null } | null>(null)
  const pickerValue = emitted && emitted.value === value ? emitted.date : parsed
  const handleChange = (next: Dayjs | null) => {
    const nextValue = format(next)
    setEmitted({ value: nextValue, date: next })
    onChange(nextValue)
  }
  return [pickerValue, handleChange] as const
}

type PickerInputProps<Name extends 'date' | 'start' | 'end'> = {
  field: ControllerRenderProps<BookingFormValues, Name>
  error?: FieldError
  disabled: boolean
  autoFocus?: boolean
  onValueChange: (value: string) => void
}

function DateInput({ field, error, disabled, onValueChange }: PickerInputProps<'date'>) {
  const [value, handleChange] = usePickerValue(
    field.value,
    parseDateValue,
    formatDateValue,
    (v) => {
      field.onChange(v)
      onValueChange(v)
    },
  )
  return (
    <DatePicker
      label="Дата"
      value={value}
      onChange={handleChange}
      format="DD.MM.YYYY"
      disablePast
      disabled={disabled}
      inputRef={field.ref}
      enableAccessibleFieldDOMStructure={false}
      slotProps={{
        textField: {
          name: field.name,
          onBlur: field.onBlur,
          error: Boolean(error),
          helperText: error?.message,
          fullWidth: true,
        },
      }}
    />
  )
}

const MIN_TIME = parseTimeValue(WORK_DAY_START)
const MAX_TIME = parseTimeValue(WORK_DAY_END)

function TimeInput({
  label,
  field,
  error,
  disabled,
  autoFocus,
  onValueChange,
}: PickerInputProps<'start' | 'end'> & { label: string }) {
  const [value, handleChange] = usePickerValue(
    field.value,
    parseTimeValue,
    formatTimeValue,
    (v) => {
      field.onChange(v)
      onValueChange(v)
    },
  )
  return (
    <TimePicker
      label={label}
      value={value}
      onChange={handleChange}
      ampm={false}
      format="HH:mm"
      views={['hours', 'minutes']}
      timeSteps={{ minutes: TIME_STEP_MINUTES }}
      // Picker limits only shape the popup; typed values are validated by the domain rules.
      minTime={MIN_TIME ?? undefined}
      maxTime={MAX_TIME ?? undefined}
      disabled={disabled}
      autoFocus={autoFocus}
      inputRef={field.ref}
      enableAccessibleFieldDOMStructure={false}
      slotProps={{
        textField: {
          name: field.name,
          onBlur: field.onBlur,
          error: Boolean(error),
          helperText: error?.message,
          fullWidth: true,
        },
      }}
    />
  )
}
