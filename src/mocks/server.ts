import { setupServer } from 'msw/node'
import { createBookingsDb, memoryStorage } from './db'
import { createDevSettings, type DevSettings } from './devSettings'
import { createHandlers } from './handlers'

const testDefaults: DevSettings = {
  latencyMs: 0,
  failListRequests: false,
  simulateConflictOnce: false,
}

export const db = createBookingsDb(memoryStorage())
export const devSettings = createDevSettings({ defaults: testDefaults })
export const server = setupServer(...createHandlers({ db, settings: devSettings }))

/** Empty db (not seed) and default test settings. */
export function resetMockState() {
  db.reset([])
  devSettings.reset()
}
