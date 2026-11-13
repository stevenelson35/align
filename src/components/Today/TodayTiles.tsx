import { useRef } from 'react'
import { TodaySectionScope } from '../../context/TodaySections'
import { useStoredSet } from '../../hooks/useStoredSet'
import { grouped, known, parseTile, type Tile } from '../../utils/tiles'
import { Icon } from '../UI/Icon'
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
      {grouped(tiles.filter(known)).map((g) => (
        <div key={g.name ?? ''} className={g.name ? 'tile-group' : 'tile-ungrouped'} {...press}>
          {g.name && (
            <h3 className="tile-group-heading">
              <button type="button" className="tile-group-toggle" onClick={() => toggleFolded(g.name!)} aria-expanded={!folded.has(g.name)}>
                <span className="tile-group-name">{g.name}</span>
                {folded.has(g.name) && <span className="muted small"> {g.tiles.length}</span>}
                <Icon name={folded.has(g.name) ? 'more' : 'list'} />
              </button>
            </h3>
          )}
          {!(g.name && folded.has(g.name)) &&
            g.tiles.map((t) => {
              const { kind, id } = parseTile(t)
              // Panels keep their own name for folding siblings (To Do registers as "tasks").
              return (
                <TodaySectionScope key={t} id={kind === 'panel' ? id : t}>
                  <TileView tile={t} day={day} />
                </TodaySectionScope>
              )
            })}
        </div>
      ))}
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
      if (e.button !== 0 || !target.closest('.section-header, .tile-group-heading') || target.closest('input, textarea, select, a, .entry-row')) return
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
      if ((e.target as HTMLElement).closest('.section-header, .tile-group-heading') && !(e.target as HTMLElement).closest('a, .entry-row')) e.preventDefault()
    },
  }
}
