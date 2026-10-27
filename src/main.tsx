import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { Providers } from '@/app/providers'
import { bookingsApi, type BookingsApi } from '@/api'

const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false'
const DevPanel = useMocks ? lazy(() => import('./mocks/DevPanel')) : null

async function bootstrap() {
  let api: BookingsApi | undefined
  if (useMocks) {
    try {
      const { worker, withMockClient } = await import('./mocks/browser')
      await worker.start({
        onUnhandledFrame: 'bypass',
        serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
      })
      api = withMockClient(bookingsApi)
    } catch (error) {
      // e.g. Service Workers disabled (private mode): still render, requests show a network error
      console.error('Mock API failed to start', error)
    }
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Providers api={api}>
        <App />
        {DevPanel && (
          <Suspense fallback={null}>
            <DevPanel />
          </Suspense>
        )}
      </Providers>
    </StrictMode>,
  )
}

void bootstrap()
