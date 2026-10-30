import { useId, useSyncExternalStore } from 'react'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import { useQueryClient } from '@tanstack/react-query'
import { bookingKeys } from '@/features/bookings/queries'
import { db, devSettings } from '@/mocks/browser'

const LATENCY_OPTIONS = [0, 400, 1500, 3000]

/** Demo-only controls for the mock server: lets a reviewer reproduce loading, 500 and 409 states. */
export default function DevPanel() {
  const settings = useSyncExternalStore(devSettings.subscribe, devSettings.get)
  const queryClient = useQueryClient()
  const latencyLabelId = useId()

  const refresh = () => void queryClient.invalidateQueries({ queryKey: bookingKeys.all })

  return (
    <Container maxWidth="md" sx={{ pb: 4 }}>
      <Accordion variant="outlined" disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography component="h2" variant="subtitle1">
            Симуляция сервера (демо)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Mock API работает в браузере (MSW), данные хранятся в localStorage.
            </Typography>
            <FormControl size="small" sx={{ maxWidth: 240 }}>
              <InputLabel id={latencyLabelId}>Задержка ответа</InputLabel>
              <Select
                labelId={latencyLabelId}
                label="Задержка ответа"
                value={settings.latencyMs}
                onChange={(e) => devSettings.set({ latencyMs: Number(e.target.value) })}
              >
                {LATENCY_OPTIONS.map((ms) => (
                  <MenuItem key={ms} value={ms}>
                    {ms} мс
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.failListRequests}
                  onChange={(e) => {
                    devSettings.set({ failListRequests: e.target.checked })
                    refresh()
                  }}
                />
              }
              label="Загрузка списка возвращает 500"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.simulateConflictOnce}
                  onChange={(e) => devSettings.set({ simulateConflictOnce: e.target.checked })}
                />
              }
              label="Следующее сохранение: слот займёт «другой пользователь» (409)"
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                variant="outlined"
                onClick={() => {
                  db.reset()
                  refresh()
                }}
              >
                Сбросить данные к демо
              </Button>
              <Button
                variant="text"
                onClick={() => {
                  devSettings.reset()
                  refresh()
                }}
              >
                Сбросить настройки
              </Button>
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Container>
  )
}
