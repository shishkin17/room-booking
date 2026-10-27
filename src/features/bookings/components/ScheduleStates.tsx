import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Skeleton from '@mui/material/Skeleton'
import { isApiError } from '@/api/errors'

const visuallyHidden = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
} as const

// Only our own ApiError messages are user-facing; anything else may be a raw technical error.
function messageOf(error: unknown): string {
  return isApiError(error) && error.message ? error.message : 'Не удалось загрузить расписание'
}

export function ScheduleSkeleton() {
  return (
    <>
      <Box component="span" sx={visuallyHidden} role="status">
        Загрузка…
      </Box>
      <List aria-busy="true" aria-label="Загрузка расписания" disablePadding>
        {[0, 1, 2, 3].map((i) => (
          <ListItem key={i} disableGutters>
            <Skeleton variant="rounded" width="100%" height={64} />
          </ListItem>
        ))}
      </List>
    </>
  )
}

export function RefreshIndicator() {
  return (
    <LinearProgress
      aria-label="Обновление"
      sx={{ position: 'absolute', top: 0, left: 0, right: 0, borderRadius: 1 }}
    />
  )
}

export function ErrorState({
  error,
  onRetry,
  retrying,
  stale,
}: {
  error: unknown
  onRetry: () => void
  /** A retry request is in flight. */
  retrying?: boolean
  /** Stale data is still shown below. */
  stale?: boolean
}) {
  return (
    <Alert
      severity={stale ? 'warning' : 'error'}
      sx={{ mb: 2 }}
      action={
        <Button color="inherit" size="small" loading={retrying} onClick={onRetry}>
          Повторить
        </Button>
      }
    >
      {stale ? `Не удалось обновить данные: ${messageOf(error)}` : messageOf(error)}
    </Alert>
  )
}
