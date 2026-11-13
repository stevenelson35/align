import { useRef } from 'react'
import { TodaySectionScope } from '../../context/TodaySections'
import { useStoredSet } from '../../hooks/useStoredSet'
import { grouped, known, parseTile, type Tile } from '../../utils/tiles'
import { SectionHeader } from '../UI/SectionHeader'
import { TileView } from './TileView'

/**
 * Tiles in your order, under your group headings (tap a heading to fold the group; remembered on this device).
 * Pressing and holding a tile's heading (or a group's) starts arranging.
 */
export function TodayTiles({ tiles, day, onArrange }: { tiles: Tile[]; day: string; onArrange?: () => void }) {
  const [folded, toggleFolded] = useStoredSet('align-today-folded-groups')
  const press = useHoldToArrange(onArrange)
  return (
    <>
      {grouped(tiles.filter(known)).map((g) => {
        const tilesHere = g.tiles.map((t) => {
          const { kind, id } = parseTile(t)
          // Panels keep their own name for folding siblings (To Do registers as "tasks").
          return (
            <TodaySectionScope key={t} id={kind === 'panel' ? id : t}>
              <TileView tile={t} day={day} />
            </TodaySectionScope>
          )
        })
        if (!g.name)
          return (
            <div key="" className="tile-ungrouped" {...press}>
              {tilesHere}
            </div>
          )
        const isFolded = folded.has(g.name)
        return (
          <div key={g.name} className={`tile-group${isFolded ? ' folded' : ''}`} {...press}>
            <div className="day-section tile-group-head">
              <SectionHeader icon="folder" title={g.name} count={g.tiles.length} onTitleClick={() => toggleFolded(g.name!)} expanded={!isFolded}>
                <button type="button" className="link small" onClick={() => toggleFolded(g.name!)} aria-expanded={!isFolded}>
                  {isFolded ? 'Show' : 'Hide'}
                </button>
              </SectionHeader>
            </div>
            {!isFolded && (g.tiles.length ? <div className="tile-group-body">{tilesHere}</div> : <p className="muted small tile-group-empty">Nothing in this group yet. Use + (Add) and pick this group, or Arrange to drag tiles under it.</p>)}
          </div>
        )
      })}
    </>
  )
}

/**
 * Press and hold a heading (not a row, a field or a link: rows have their own menu) to start arranging Today. The
 * tap that ends the hold is swallowed, so the heading doesn't also fold or open.
 */
function useHoldToArrange(onArrange?: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const start = useRef<{ x: number; y: number } | null>(null)
  const cancel = () => {
    clearTimeout(timer.current)
    start.current = null
  }
  if (!onArrange) return {}
  return {
    onPointerDown: (e: React.PointerEvent) => {
      const target = e.target as HTMLElement
      if (e.button !== 0 || !target.closest('.section-header') || target.closest('input, textarea, select, a, .entry-row')) return
      start.current = { x: e.clientX, y: e.clientY }
      timer.current = setTimeout(() => {
        start.current = null
        const swallow = (ev: Event) => {
          ev.stopPropagation()
          ev.preventDefault()
        }
        window.addEventListener('click', swallow, { capture: true, once: true })
        setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 800)
        navigator.vibrate?.(15)
        onArrange()
      }, 550)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => {
      // A phone's long press would also open the browser's menu on a heading.
      if ((e.target as HTMLElement).closest('.section-header') && !(e.target as HTMLElement).closest('a, .entry-row')) e.preventDefault()
    },
  }
}
