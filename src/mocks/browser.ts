import { setupWorker } from 'msw/browser'
import type { BookingsApi } from '@/api/bookingsApi'
import { createBookingsDb } from './db'
import { createDevSettings } from './devSettings'
import { createHandlers } from './handlers'

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const storage = safeLocalStorage()

export const db = createBookingsDb(storage)
export const devSettings = createDevSettings({ storage })
export const worker = setupWorker(...createHandlers({ db, settings: devSettings }))

const ACTIVATE_TIMEOUT_MS = 1000

/**
 * The worker keeps the ids of mocked tabs in memory only. While the tab is hidden the browser
 * throttles MSW's keepalive and may stop the idle worker; the restarted one forgets this tab and
 * lets `/api/*` through to the dev server, which answers with index.html ("Что-то пошло не так").
 * Re-registering is idempotent, so we do it before every API call and wait for the confirmation;
 * the worker records the tab before replying, so the following request is mocked.
 */
function activateMockClient(): Promise<void> {
  const container = navigator.serviceWorker
  const controller = container?.controller
  if (!controller) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      container.removeEventListener('message', onMessage)
      resolve()
    }
    const onMessage = (event: MessageEvent) => {
      if (event.source !== controller || event.data?.type !== 'MOCKING_ENABLED') return
      // The worker awaits a reply on this port; answer so it doesn't hang on to it.
      event.ports[0]?.postMessage(null)
      done()
    }
    // Never block the request: without a reply it goes out as is.
    const timer = setTimeout(done, ACTIVATE_TIMEOUT_MS)
    container.addEventListener('message', onMessage)
    controller.postMessage('MOCK_ACTIVATE')
  })
}

/** Wraps the HTTP API so each call first makes sure the mock worker still handles this tab. */
export function withMockClient(api: BookingsApi): BookingsApi {
  return {
    list: (...args) => activateMockClient().then(() => api.list(...args)),
    create: (...args) => activateMockClient().then(() => api.create(...args)),
    update: (...args) => activateMockClient().then(() => api.update(...args)),
    remove: (...args) => activateMockClient().then(() => api.remove(...args)),
  }
}
