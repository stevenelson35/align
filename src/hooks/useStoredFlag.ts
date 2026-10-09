import { useState } from 'react'

/** An on/off preference remembered on this device (localStorage), e.g. "hide finished" per list. */
export function useStoredFlag(key: string, initial: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => {
    const saved = localStorage.getItem(key)
    return saved === null ? initial : saved === '1'
  })
  return [
    value,
    (next: boolean) => {
      localStorage.setItem(key, next ? '1' : '0')
      setValue(next)
    },
  ]
}
