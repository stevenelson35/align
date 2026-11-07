import { createContext, type RefObject } from 'react'

export type TodayRegistration = { id: string; collapse: () => void }
export const TodayContext = createContext<{
  register: (entry: TodayRegistration) => () => void
  select: (id: string) => void
} | null>(null)
export const TodaySectionContext = createContext<{ id: string; element: RefObject<HTMLDivElement | null> } | null>(null)
