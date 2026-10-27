import { render, screen } from '@testing-library/react'
import { App } from './App'
import { Providers, createQueryClient } from './providers'

describe('App', () => {
  it('renders the heading and the empty day', async () => {
    render(
      <Providers client={createQueryClient()}>
        <App />
      </Providers>,
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Бронирование переговорной' }),
    ).toBeInTheDocument()
    expect(await screen.findByText(/На эту дату броней нет/)).toBeInTheDocument()
  })
})
