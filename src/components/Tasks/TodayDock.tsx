import { useEffect, useState, type ReactNode } from 'react'
import { useApp } from '../../hooks/useApp'
import { useTodayItems } from '../../hooks/useTodayItems'
import { Icon } from '../UI/Icon'
import { ArrangeToday } from './ArrangeToday'
import { TodayShortcuts } from './TodayShortcuts'

/**
 * Today's footer, always at the bottom of the screen: More… (the sections you moved off the main page, and Arrange
 * Today) and Shortcuts… (the people and links you added to Shortcuts). Each opens a panel just above the footer;
 * tapping it again, ✕, or Escape closes it.
 */
export function TodayDock({ more, moreCount }: { more: ReactNode; moreCount: number }) {
  const { isMember } = useApp()
  const shortcuts = useTodayItems()
  const [open, setOpen] = useState<'more' | 'shortcuts' | null>(null)
  const toggle = (which: 'more' | 'shortcuts') => setOpen(open === which ? null : which)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="today-dock">
      {open && (
        <div className="today-sheet" role="region" aria-label={open === 'more' ? 'More' : 'Shortcuts'}>
          <header className="row">
            <strong className="grow">{open === 'more' ? 'More' : 'Shortcuts'}</strong>
            <button type="button" className="link" onClick={() => setOpen(null)} aria-label="Close">
              <Icon name="close" />
            </button>
          </header>
          {open === 'more' ? (
            <>
              {moreCount ? more : <p className="muted small">Everything is on the main page. Arrange Today moves sections here.</p>}
              {isMember && <ArrangeToday />}
            </>
          ) : (
            <TodayShortcuts />
          )}
        </div>
      )}
      <nav className="today-footer" aria-label="More and shortcuts">
        <button type="button" className={open === 'more' ? 'on' : ''} onClick={() => toggle('more')} aria-expanded={open === 'more'}>
          <Icon name="list" /> More…{moreCount ? <span className="muted small"> {moreCount}</span> : null}
        </button>
        <button type="button" className={open === 'shortcuts' ? 'on' : ''} onClick={() => toggle('shortcuts')} aria-expanded={open === 'shortcuts'}>
          <Icon name="star" /> Shortcuts…{shortcuts.ids.length ? <span className="muted small"> {shortcuts.ids.length}</span> : null}
        </button>
      </nav>
    </div>
  )
}
