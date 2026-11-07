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
      if (!element || !sheet || !header) return
      const align = () => sheet.scrollTo({ top: sheet.scrollTop + header.getBoundingClientRect().top - sheet.getBoundingClientRect().top - 12 })
      align()
      // Sections like Investing load their contents after opening, and until then the sheet may be too short to
      // bring the heading up. Keep aligning as the section grows, briefly, unless the person starts scrolling.
      const grow = new ResizeObserver(align)
      const stop = () => {
        grow.disconnect()
        for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const) sheet.removeEventListener(type, stop)
      }
      for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const) sheet.addEventListener(type, stop, { passive: true })
      grow.observe(element)
      setTimeout(stop, 2000)
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
