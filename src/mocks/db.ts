import type { Booking, BookingInput, IsoDate } from '@/domain/booking'
import { isValidIsoDate, isValidTimeOfDay } from '@/domain/time'

export type MockStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const DB_STORAGE_KEY = 'mrb.bookings.v1'

export function memoryStorage(): MockStorage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function createSeed(now: Date = new Date()): Booking[] {
  const today = isoOf(now)
  const tomorrowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const tomorrow = isoOf(tomorrowDate)
  const make = (date: IsoDate, start: string, end: string, title: string): Booking => ({
    id: crypto.randomUUID(),
    date,
    start,
    end,
    title,
  })
  return [
    make(today, '09:00', '10:00', 'Планёрка'),
    make(today, '14:00', '15:30', 'Созвон с клиентом'),
    make(tomorrow, '11:00', '12:00', 'Ретро'),
    make(tomorrow, '16:00', '17:00', 'Интервью с кандидатом'),
  ]
}

const byStart = (a: Booking, b: Booking) => a.start.localeCompare(b.start)

export function createBookingsDb(storage: MockStorage | null) {
  const map = new Map<string, Booking>()

  function persist() {
    try {
      storage?.setItem(DB_STORAGE_KEY, JSON.stringify([...map.values()]))
    } catch {
      // storage unavailable or full: keep working in memory
    }
  }

  /** Guards against hand-edited or outdated localStorage entries crashing the handlers. */
  function isStoredBooking(item: unknown): item is Booking {
    if (typeof item !== 'object' || item === null) return false
    const b = item as Record<string, unknown>
    return (
      typeof b.id === 'string' &&
      typeof b.date === 'string' &&
      isValidIsoDate(b.date) &&
      typeof b.start === 'string' &&
      isValidTimeOfDay(b.start) &&
      typeof b.end === 'string' &&
      isValidTimeOfDay(b.end) &&
      (b.title === undefined || typeof b.title === 'string')
    )
  }

  function load() {
    let raw: string | null
    try {
      raw = storage?.getItem(DB_STORAGE_KEY) ?? null
    } catch {
      raw = null
    }
    if (raw !== null) {
      try {
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          for (const item of parsed as Booking[]) {
            if (isStoredBooking(item)) map.set(item.id, item)
          }
          return
        }
      } catch {
        // corrupt JSON: fall through to seed
      }
    }
    for (const b of createSeed()) map.set(b.id, b)
    persist()
  }

  load()

  return {
    listByDate(date: IsoDate): Booking[] {
      return [...map.values()].filter((b) => b.date === date).sort(byStart)
    },
    get(id: string): Booking | undefined {
      return map.get(id)
    },
    insert(input: BookingInput): Booking {
      const booking: Booking = { ...input, id: crypto.randomUUID() }
      map.set(booking.id, booking)
      persist()
      return booking
    },
    update(id: string, next: BookingInput): Booking | undefined {
      if (!map.has(id)) return undefined
      const booking: Booking = { ...next, id }
      map.set(id, booking)
      persist()
      return booking
    },
    remove(id: string): boolean {
      const removed = map.delete(id)
      if (removed) persist()
      return removed
    },
    reset(seed: readonly Booking[] = createSeed()) {
      map.clear()
      for (const b of seed) map.set(b.id, b)
      persist()
    },
    all(): Booking[] {
      return [...map.values()].sort(byStart)
    },
  }
}

export type BookingsDb = ReturnType<typeof createBookingsDb>
