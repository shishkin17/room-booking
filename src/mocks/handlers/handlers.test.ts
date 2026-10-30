import type { Booking } from '@/domain/booking'
import { overlaps } from '@/domain/rules'
import { db, devSettings } from '@/mocks/server'

const DATE = '2099-01-15'

async function patch(id: string, body: object) {
  return fetch(`http://localhost/api/bookings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('mock server: simulated concurrent booking', () => {
  it('on edit, reports only the free part of the range and stores nothing', async () => {
    const own = db.insert({ date: DATE, start: '10:00', end: '11:00', title: 'Моя' })
    devSettings.set({ simulateConflictOnce: true })

    const response = await patch(own.id, { start: '10:00', end: '11:30' })

    expect(response.status).toBe(409)
    const body = (await response.json()) as { details: { conflictingBooking: Booking } }
    const conflicting = body.details.conflictingBooking
    expect(conflicting).toMatchObject({ date: DATE, start: '11:00', end: '11:30' })
    expect(overlaps(conflicting, own)).toBe(false)
    expect(db.listByDate(DATE)).toEqual([own])
    expect(devSettings.get().simulateConflictOnce).toBe(false)
  })

  it('on create, rejects with 409 without saving anything', async () => {
    devSettings.set({ simulateConflictOnce: true })

    const response = await fetch('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: DATE, start: '10:00', end: '11:00' }),
    })

    expect(response.status).toBe(409)
    expect(db.listByDate(DATE)).toHaveLength(0)
  })

  it('stays armed when the edit has no free part to take (title-only change)', async () => {
    const own = db.insert({ date: DATE, start: '10:00', end: '11:00' })
    devSettings.set({ simulateConflictOnce: true })

    const response = await patch(own.id, { title: 'Новое название' })

    expect(response.status).toBe(200)
    expect(db.listByDate(DATE)).toHaveLength(1)
    expect(devSettings.get().simulateConflictOnce).toBe(true)
  })
})
