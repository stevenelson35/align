import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useApp } from '../../hooks/useApp'
import { useTodayItems } from '../../hooks/useTodayItems'
import { Icon } from '../UI/Icon'
import { ArrangeToday } from './ArrangeToday'
import { TodayShortcuts } from './TodayShortcuts'

/**
 * Today's footer, always at the bottom of the screen: More… (the sections you moved off the main page, and Arrange
 * Today) and Shortcuts… (the people and links you added to Shortcuts). Each opens a panel just above the footer;
 * tapping it again, its title, ✕, Escape, or a tap anywhere outside the dock closes it.
 */
export function TodayDock({ more, moreCount }: { more: ReactNode; moreCount: number }) {
  const { isMember } = useApp()
  const shortcuts = useTodayItems()
  const [open, setOpen] = useState<'more' | 'shortcuts' | null>(null)
  const toggle = (which: 'more' | 'shortcuts') => setOpen(open === which ? null : which)
  const dock = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    // A tap on the page behind (a goal, Reveal, …) closes the sheet and still does its own thing. On click, not
    // pointerdown, so a scroll drag doesn't close it and the page doesn't shift under the finger mid-tap. Capture
    // phase, so a handler that stops propagation can't keep the sheet open. Dialogs opened from inside the sheet are
    // rendered inside the dock, so taps in them count as inside.
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Node && !dock.current?.contains(e.target)) setOpen(null)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('click', onClick, true)
    }
  }, [open])

  return (
    <div className="today-dock" ref={dock}>
      {open && (
        <div className="today-sheet" role="region" aria-label={open === 'more' ? 'More' : 'Shortcuts'}>
          <header className="row">
            <button type="button" className="link grow today-sheet-title" onClick={() => setOpen(null)} aria-label={`Close ${open === 'more' ? 'More' : 'Shortcuts'}`}>
              <strong>{open === 'more' ? 'More' : 'Shortcuts'}</strong>
            </button>
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
