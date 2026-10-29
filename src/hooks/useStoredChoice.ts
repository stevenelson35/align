import { useState } from 'react'

/** One of a few choices remembered on this device (localStorage), e.g. a section's Mine / Family / Shared filter. */
export function useStoredChoice<T extends string>(key: string, choices: readonly T[], initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const saved = localStorage.getItem(key) as T | null
    return saved && choices.includes(saved) ? saved : initial
  })
  return [
    value,
    (next: T) => {
      localStorage.setItem(key, next)
      setValue(next)
    },
  ]
}
