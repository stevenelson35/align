import { useCallback, useContext, useEffect } from 'react'
import { TodayContext, TodaySectionContext } from '../context/TodayContext'

/** Selecting a section folds its siblings; only the More sheet scrolls, not the page behind it. */
export function useTodaySelect(collapse?: () => void, id?: string) {
  const today = useContext(TodayContext)
  const section = useContext(TodaySectionContext)
  const key = id ?? section?.id
  useEffect(() => {
    if (today && key && collapse) return today.register({ id: key, collapse })
  }, [today, key, collapse])
  return useCallback(() => {
    if (!today || !key) return
    today.select(key)
    requestAnimationFrame(() => {
      const element = section?.element.current
      const sheet = element?.closest<HTMLElement>('.today-sheet')
      const header = element?.querySelector('.section-header')
      if (sheet && header) {
        sheet.scrollTo({ top: sheet.scrollTop + header.getBoundingClientRect().top - sheet.getBoundingClientRect().top - 12 })
      }
    })
  }, [today, key, section])
}

export function useTodayExpansion(open: boolean, save: (value: boolean) => void) {
  const select = useTodaySelect(() => { if (open) save(false) })
  return (next: boolean) => {
    if (next) select()
    save(next)
  }
}
