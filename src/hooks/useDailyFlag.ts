import { useState } from 'react'
import { today } from '../engine/dates'

/**
 * An on/off choice that starts at `initial` each day and keeps what you picked for the rest of that day (this
 * device). E.g. the day view's Goals start hidden and On this day starts shown, every morning.
 */
export function useDailyFlag(key: string, initial: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as { day: string; value: boolean } | null
      return saved && saved.day === today() ? saved.value : initial
    } catch {
      return initial
    }
  })
  return [
    value,
    (next: boolean) => {
      localStorage.setItem(key, JSON.stringify({ day: today(), value: next }))
      setValue(next)
    },
  ]
}
