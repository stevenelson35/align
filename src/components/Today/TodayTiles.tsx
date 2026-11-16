import { useRef } from 'react'
import { TodaySectionScope } from '../../context/TodaySections'
import { useStoredSet } from '../../hooks/useStoredSet'
import { grouped, known, parseTile, type Tile, type TilePlace } from '../../utils/tiles'
import { Icon } from '../UI/Icon'
import { SectionHeader } from '../UI/SectionHeader'
import { useTileGap } from '../../hooks/useTileGap'
import { TileView } from './TileView'

/**
 * Tiles in your order, under your group headings (tap a heading to fold the group; remembered on this device).
 * Pressing and holding a tile's heading (or a group's) starts arranging.
 */
export function TodayTiles({ tiles, day, onArrange, onAdd }: { tiles: Tile[]; day: string; onArrange?: () => void; /** A group's +: Add to Today aimed at that group. */ onAdd?: (place: TilePlace) => void }) {
  const [folded, toggleFolded] = useStoredSet('align-today-folded-groups')
  const press = useHoldToArrange(onArrange)
  const gap = useTileGap()
  return (
    <div className="today-tiles" style={{ '--tile-gap': `${gap}rem` } as React.CSSProperties}>
      {grouped(tiles.filter(known)).map((g, gi) => {
        const tilesHere = g.tiles.map((t) => {
          const { kind, id } = parseTile(t)
          // Panels keep their own name for folding siblings (To Do registers as "tasks").
          return (
            <TodaySectionScope key={t} id={kind === 'panel' ? id : t} className="tile">
              <TileView tile={t} day={day} />
            </TodaySectionScope>
          )
        })
        if (!g.name)
          return (
            <div key={`u${gi}`} className="tile-ungrouped" {...press}>
              {tilesHere}
            </div>
          )
        const isFolded = folded.has(g.name)
        return (
          <div key={g.name} className={`tile-group${isFolded ? ' folded' : ''}`} {...press}>
            <div className="day-section tile-group-head">
              <SectionHeader icon="folder" title={g.name} count={g.tiles.length} onTitleClick={() => toggleFolded(g.name!)} expanded={!isFolded}>
                {onAdd && (
                  <button type="button" className="link small header-add" onClick={() => onAdd({ group: g.name! })} title={`Add to ${g.name}, or take something out`} aria-label={`Add to ${g.name}`}>
                    <Icon name="plus" />
                  </button>
                )}
                <button type="button" className="link small" onClick={() => toggleFolded(g.name!)} aria-expanded={!isFolded}>
                  {isFolded ? 'Show' : 'Hide'}
                </button>
              </SectionHeader>
            </div>
            {!isFolded && (g.tiles.length ? <div className="tile-group-body">{tilesHere}</div> : <p className="muted small tile-group-empty">Nothing in this group yet. Tap + on its heading to add something.</p>)}
          </div>
        )
      })}
    </div>
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
      // A heading, or an entry pinned on its own (one flat line); not a field, a link, or a row inside a list.
      const onEntry = !!target.closest('.tile-entry > .entry-row.flat') && !target.closest('.entry-detail, .tile-person-peek, .entry-menu')
      if (e.button !== 0 || (!target.closest('.section-header') && !onEntry) || target.closest('input, textarea, select, a') || (!onEntry && target.closest('.entry-row'))) return
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
      const t = e.target as HTMLElement
      if ((t.closest('.section-header') || t.closest('.tile-entry > .entry-row.flat')) && !t.closest('a')) e.preventDefault()
    },
  }
}
