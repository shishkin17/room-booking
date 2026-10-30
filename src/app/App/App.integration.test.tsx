import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient } from '@tanstack/react-query'
import { db, devSettings } from '@/mocks/server'
import { App } from './App'
import { Providers } from '@/app/providers'

const DATE = '2026-10-27'

function renderApp() {
  window.history.replaceState(null, '', `/?date=${DATE}`)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  })
  return render(
    <Providers client={client}>
      <App />
    </Providers>,
  )
}

const seed = (start: string, end: string, title?: string) =>
  db.insert({ date: DATE, start, end, ...(title ? { title } : {}) })

beforeEach(() => {
  // Fake only Date so MSW and RTL timers keep working. 08:00 local, before the work day.
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 27, 8, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('App integration', () => {
  it('creates a booking from a free slot', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(
      await screen.findByRole('button', { name: 'Свободно 09:00–18:00, забронировать' }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Новая бронь' })
    expect(within(dialog).getByLabelText('Начало')).toHaveValue('09:00')
    expect(within(dialog).getByLabelText('Окончание')).toHaveValue('10:00')

    await user.type(within(dialog).getByRole('textbox', { name: /Название/ }), 'Планирование')
    await user.click(within(dialog).getByRole('button', { name: 'Забронировать' }))

    expect(await screen.findByText('Бронь создана')).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: 'Изменить бронь 09:00–10:00' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Планирование')).toBeInTheDocument()
    expect(db.all()).toMatchObject([
      { date: DATE, start: '09:00', end: '10:00', title: 'Планирование' },
    ])
  })

  it('keeps the dialog and form data on 409 and saves nothing', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(
      await screen.findByRole('button', { name: 'Свободно 09:00–18:00, забронировать' }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Новая бронь' })
    await user.type(within(dialog).getByRole('textbox', { name: /Название/ }), 'Мой созвон')

    devSettings.set({ simulateConflictOnce: true })
    await user.click(within(dialog).getByRole('button', { name: 'Забронировать' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/только что заняли/)
    expect(screen.getByRole('dialog', { name: 'Новая бронь' })).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: /Название/ })).toHaveValue('Мой созвон')
    expect(within(dialog).getByLabelText('Начало')).toHaveValue('09:00')
    expect(within(dialog).getByLabelText('Окончание')).toHaveValue('10:00')
    expect(db.all()).toHaveLength(0)
  })

  it('shows a load error and recovers on retry', async () => {
    const user = userEvent.setup()
    devSettings.set({ failListRequests: true })
    seed('10:00', '11:00', 'Ретро')
    renderApp()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Сервер временно недоступен')

    devSettings.set({ failListRequests: false })
    await user.click(within(alert).getByRole('button', { name: 'Повторить' }))

    expect(await screen.findByText('Ретро')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not conflict with itself when editing', async () => {
    const user = userEvent.setup()
    seed('10:00', '11:00', 'Старое название')
    renderApp()

    await user.click(await screen.findByRole('button', { name: 'Изменить бронь 10:00–11:00' }))
    const dialog = await screen.findByRole('dialog', { name: 'Изменить бронь' })
    const title = within(dialog).getByRole('textbox', { name: /Название/ })
    await user.clear(title)
    await user.type(title, 'Новое название')
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    expect(await screen.findByText('Бронь обновлена')).toBeInTheDocument()
    expect(await screen.findByText('Новое название')).toBeInTheDocument()
    expect(db.all()).toMatchObject([{ start: '10:00', end: '11:00', title: 'Новое название' }])
  })

  it('deletes a booking after confirmation', async () => {
    const user = userEvent.setup()
    seed('10:00', '11:00', 'Удаляемая')
    renderApp()

    await user.click(await screen.findByRole('button', { name: 'Удалить бронь 10:00–11:00' }))
    const dialog = await screen.findByRole('dialog', { name: 'Удалить бронь?' })
    await user.click(within(dialog).getByRole('button', { name: 'Удалить' }))

    expect(await screen.findByText('Бронь удалена')).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: 'Свободно 09:00–18:00, забронировать' }),
    ).toBeInTheDocument()
    expect(db.all()).toHaveLength(0)
  })

  it('blocks submit with client-side validation when the booking is too long', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(
      await screen.findByRole('button', { name: 'Свободно 09:00–18:00, забронировать' }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Новая бронь' })
    const end = within(dialog).getByLabelText('Окончание')
    await user.click(end)
    await user.keyboard('{Control>}a{/Control}{Backspace}1300')
    await user.click(within(dialog).getByRole('button', { name: 'Забронировать' }))

    await waitFor(() => expect(end).toHaveAttribute('aria-invalid', 'true'))
    expect(within(dialog).getByText(/Максимальная длительность брони/)).toBeInTheDocument()
    expect(db.all()).toHaveLength(0)
  })
})
