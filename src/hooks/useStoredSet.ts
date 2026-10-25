import { useState } from 'react'

/** A set of strings remembered on this device (localStorage), e.g. whose view-only tasks Today also shows. Returns
 * the set, a toggle for one value, and a clear. */
export function useStoredSet(key: string): [Set<string>, (value: string) => void, () => void] {
  const [set, setSet] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(key) ?? '[]') as string[])
    } catch {
      return new Set()
    }
  })
  return [
    set,
    (value: string) => {
      const next = new Set(set)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      if (next.size) localStorage.setItem(key, JSON.stringify([...next]))
      else localStorage.removeItem(key)
      setSet(next)
    },
    () => {
      localStorage.removeItem(key)
      setSet(new Set())
    },
  ]
}
