import { useCallback, useEffect, useState } from 'react'
import type { IsoDate } from '@/domain/booking'
import { isValidIsoDate, toIsoDate } from '@/domain/time'

function readDateFromUrl(): IsoDate {
  const value = new URLSearchParams(window.location.search).get('date')
  return value && isValidIsoDate(value) ? value : toIsoDate(new Date())
}

/** Selected day kept in sync with `?date=YYYY-MM-DD` (pushState + popstate). */
export function useSelectedDate(): [IsoDate, (date: IsoDate) => void] {
  const [date, setDateState] = useState<IsoDate>(readDateFromUrl)

  useEffect(() => {
    const onPopState = () => setDateState(readDateFromUrl())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const setDate = useCallback((next: IsoDate) => {
    if (!isValidIsoDate(next) || next === readDateFromUrl()) return
    const url = new URL(window.location.href)
    url.searchParams.set('date', next)
    window.history.pushState(null, '', url)
    setDateState(next)
  }, [])

  return [date, setDate]
}
