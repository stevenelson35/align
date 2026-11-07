import { useMemo, useRef, type ReactNode } from 'react'
import { TodayContext, TodaySectionContext, type TodayRegistration } from './TodayContext'

export function TodaySections({ children }: { children: ReactNode }) {
  const entries = useRef(new Set<TodayRegistration>())
  const value = useMemo(() => ({
    register(entry: TodayRegistration) {
      entries.current.add(entry)
      return () => { entries.current.delete(entry) }
    },
    select(id: string) {
      for (const entry of entries.current) if (entry.id !== id) entry.collapse()
    },
  }), [])
  return <TodayContext.Provider value={value}>{children}</TodayContext.Provider>
}

export function TodaySectionScope({ id, children }: { id: string; children: ReactNode }) {
  const element = useRef<HTMLDivElement>(null)
  const value = useMemo(() => ({ id, element }), [id])
  return <TodaySectionContext.Provider value={value}><div ref={element}>{children}</div></TodaySectionContext.Provider>
}
