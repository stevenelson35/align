// Which of The Daily's items show, and the math puzzle's grade: chosen per device in Settings.
import { useSyncExternalStore } from 'react'

export type DailyItem = 'word' | 'joke' | 'quote' | 'think' | 'philosophy' | 'fact' | 'riddle' | 'math' | 'chess' | 'chessTip' | 'poker' | 'space' | 'picture' | 'animal'

export const DAILY_ITEMS: { value: DailyItem; label: string }[] = [
  { value: 'word', label: 'Word of the day' },
  { value: 'joke', label: 'Joke' },
  { value: 'quote', label: 'Quote' },
  { value: 'think', label: 'Something to think about' },
  { value: 'philosophy', label: 'Mini Philosophy video (Jonny Thomson)' },
  { value: 'fact', label: 'Science fact' },
  { value: 'riddle', label: 'Riddle' },
  { value: 'math', label: 'Math puzzle' },
  { value: 'chess', label: 'Chess puzzle (mate in one)' },
  { value: 'chessTip', label: 'Chess lesson' },
  { value: 'poker', label: 'Poker odds (Texas Hold’em)' },
  { value: 'space', label: 'Space picture (NASA)' },
  { value: 'picture', label: 'Picture of the day (Wikipedia)' },
  { value: 'animal', label: 'Wild animal (guess what it is)' },
]

const HIDDEN = 'align-daily-hidden-items'
const GRADE = 'align-daily-grade'
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

const read = () => `${localStorage.getItem(HIDDEN) ?? ''}|${localStorage.getItem(GRADE) ?? ''}`

/** The settings, live: { hidden items, math grade (default 4) }. */
export function useDailySettings(): { hidden: Set<DailyItem>; grade: number } {
  const raw = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    read,
    () => '|',
  )
  const [h, g] = raw.split('|')
  return { hidden: new Set(h ? (h.split(',') as DailyItem[]) : []), grade: Number(g) || 4 }
}

export function setDailyItemShown(item: DailyItem, shown: boolean) {
  const hidden = new Set((localStorage.getItem(HIDDEN) ?? '').split(',').filter(Boolean))
  if (shown) hidden.delete(item)
  else hidden.add(item)
  if (hidden.size) localStorage.setItem(HIDDEN, [...hidden].join(','))
  else localStorage.removeItem(HIDDEN)
  notify()
}

export function setDailyGrade(grade: number) {
  localStorage.setItem(GRADE, String(grade))
  notify()
}
