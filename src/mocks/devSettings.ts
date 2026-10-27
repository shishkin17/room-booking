export type DevSettings = {
  latencyMs: number
  failListRequests: boolean
  simulateConflictOnce: boolean
}

export const DEV_SETTINGS_KEY = 'mrb.devSettings.v1'

export const defaultDevSettings: DevSettings = {
  latencyMs: 400,
  failListRequests: false,
  simulateConflictOnce: false,
}

export function createDevSettings(
  options: { storage?: Pick<Storage, 'getItem' | 'setItem'> | null; defaults?: DevSettings } = {},
) {
  const { storage = null, defaults = defaultDevSettings } = options
  const listeners = new Set<() => void>()

  let state: DevSettings = { ...defaults }
  try {
    const raw = storage?.getItem(DEV_SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DevSettings>
      state = {
        latencyMs:
          typeof parsed.latencyMs === 'number' && parsed.latencyMs >= 0
            ? parsed.latencyMs
            : defaults.latencyMs,
        failListRequests:
          typeof parsed.failListRequests === 'boolean'
            ? parsed.failListRequests
            : defaults.failListRequests,
        simulateConflictOnce:
          typeof parsed.simulateConflictOnce === 'boolean'
            ? parsed.simulateConflictOnce
            : defaults.simulateConflictOnce,
      }
    }
  } catch {
    // ignore corrupt or inaccessible storage
  }

  function commit(next: DevSettings) {
    state = next
    try {
      storage?.setItem(DEV_SETTINGS_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
    listeners.forEach((l) => l())
  }

  return {
    get: (): DevSettings => state,
    set: (partial: Partial<DevSettings>) => commit({ ...state, ...partial }),
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    reset: () => commit({ ...defaults }),
  }
}

export type DevSettingsStore = ReturnType<typeof createDevSettings>
