import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useApp } from '../../hooks/useApp'
import { Icon } from '../UI/Icon'
import { useTodaySelect } from '../../hooks/useTodaySection'
import { panelBackground } from '../../utils/panelStyle'

/**
 * Today's footer, always at the bottom of the screen: More… (the tiles below the More… line, in a panel just above
 * the footer: tapping it again, its title, ✕, Escape, or a tap anywhere outside the dock closes it), Arrange (drag
 * tiles, groups, the More… line) and + (Add to Today).
 */
export function TodayDock({ more, moreCount, onArrange, arranging = false, onAdd }: { more: ReactNode; moreCount: number; onArrange?: () => void; arranging?: boolean; onAdd?: () => void }) {
  const { member } = useApp()
  const moreStyle = member.todayPanels?.more
  const [open, setOpen] = useState<'more' | null>(null)
  const select = useTodaySelect(undefined, 'dock')
  const toggle = () => {
    if (!open) select()
    setOpen(open ? null : 'more')
  }
  const dock = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    // A tap on the page behind (a goal, Reveal, …) closes the sheet and still does its own thing. On click, not
    // pointerdown, so a scroll drag doesn't close it and the page doesn't shift under the finger mid-tap. Capture
    // phase, so a handler that stops propagation can't keep the sheet open. Dialogs opened from inside the sheet are
    // rendered inside the dock, so taps in them count as inside.
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Node && !dock.current?.contains(e.target)) {
        // Fold the sheet's sections before unmounting them, so they cannot reopen from stale saved flags.
        select()
        setOpen(null)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('click', onClick, true)
    }
  }, [open, select])

  return (
    <div className="today-dock" ref={dock}>
      {open && (
        <div className="today-sheet" role="region" aria-label="More" style={panelBackground(moreStyle, 'var(--surface)')}>
          <header className="row">
            <button type="button" className="link grow today-sheet-title" onClick={() => setOpen(null)} aria-label="Close More">
              <strong>{moreStyle?.sticker} More</strong>
            </button>
            <button type="button" className="link" onClick={() => setOpen(null)} aria-label="Close">
              <Icon name="close" />
            </button>
          </header>
          {moreCount ? more : <p className="muted small">Nothing in More… yet. Arrange moves tiles here (below the More… line).</p>}
        </div>
      )}
      <nav className="today-footer" aria-label="More and arranging">
        <button type="button" className={open ? 'on' : ''} onClick={toggle} aria-expanded={!!open} style={{ backgroundColor: moreStyle?.color ? `color-mix(in srgb, ${moreStyle.color} 16%, var(--surface))` : undefined }}>
          {moreStyle?.sticker || <Icon name="list" />} More…{moreCount ? <span className="muted small"> {moreCount}</span> : null}
        </button>
        {onArrange && (
          <button type="button" className={arranging ? 'on' : ''} onClick={() => { setOpen(null); onArrange() }} aria-pressed={arranging}>
            <Icon name="swatch" /> {arranging ? 'Done' : 'Arrange'}
          </button>
        )}
        {onAdd && (
          <button type="button" className="today-footer-add" onClick={() => { setOpen(null); onAdd() }} aria-label="Add to Today" title="Add to Today">
            <Icon name="plus" />
          </button>
        )}
      </nav>
    </div>
  )
}
