import { useRef } from 'react'
import { TodaySectionScope } from '../../context/TodaySections'
import { useStoredSet } from '../../hooks/useStoredSet'
import { allInFolder, folderTree, known, parseTile, type FolderNode, type Tile, type TilePlace } from '../../utils/tiles'
import { Icon } from '../UI/Icon'
import { SectionHeader } from '../UI/SectionHeader'
import { useTileGap } from '../../hooks/useTileGap'
import { TileView } from './TileView'
import { useTileInfo } from './useTileInfo'

/**
 * Tiles in your order, in folders (groups; a folder can hold folders: "Info/People"). A folder is one line (📁,
 * its name, how much is in it, a peek at what) that opens in place; open ones are remembered on this device, and
 * folders start closed so Home stays short. Pressing and holding a heading starts arranging.
 */
export function TodayTiles({ tiles, day, onArrange, onAdd }: { tiles: Tile[]; day: string; onArrange?: () => void; /** A folder's +: Add to Today aimed at that folder. */ onAdd?: (place: TilePlace) => void }) {
  const [openFolders, toggleOpen] = useStoredSet('align-home-open-folders')
  const press = useHoldToArrange(onArrange)
  const gap = useTileGap()
  const info = useTileInfo()
  const tileViews = (list: Tile[]) =>
    list.map((t) => {
      const { kind, id } = parseTile(t)
      // Panels keep their own name for folding siblings (To Do registers as "tasks").
      return (
        <TodaySectionScope key={t} id={kind === 'panel' ? id : t} className="tile">
          <TileView tile={t} day={day} />
        </TodaySectionScope>
      )
    })
  const folder = (f: FolderNode) => {
    const isOpen = openFolders.has(f.name)
    const inside = allInFolder(f)
    const peek = [...f.tiles.map((t) => info(t).label), ...f.children.map((c) => c.label)].join(', ')
    return (
      <div key={f.name} className={`tile-group${isOpen ? '' : ' folded'}`} {...press}>
        <div className="day-section tile-group-head">
          <SectionHeader
            icon="folder"
            title={f.label}
            count={inside.length + f.children.length}
            onTitleClick={() => toggleOpen(f.name)}
            expanded={isOpen}
            beside={!isOpen && peek ? <span className="muted small tile-peek">{peek}</span> : undefined}
          >
            {onAdd && isOpen && (
              <button type="button" className="link small header-add" onClick={() => onAdd({ group: f.name })} title={`Add to ${f.label}, or take something out`} aria-label={`Add to ${f.label}`}>
                <Icon name="plus" />
              </button>
            )}
            <button type="button" className="link small folder-chevron" onClick={() => toggleOpen(f.name)} aria-expanded={isOpen} aria-label={isOpen ? `Close ${f.label}` : `Open ${f.label}`}>
              <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} />
            </button>
          </SectionHeader>
        </div>
        {isOpen &&
          (f.tiles.length || f.children.length ? (
            <div className="tile-group-body">
              {tileViews(f.tiles)}
              {f.children.map(folder)}
            </div>
          ) : (
            <p className="muted small tile-group-empty">Nothing in this folder yet. Tap + on its heading to add something.</p>
          ))}
      </div>
    )
  }
  return (
    <div className="today-tiles" style={{ '--tile-gap': `${gap}rem` } as React.CSSProperties}>
      {folderTree(tiles.filter(known)).map((n, i) =>
        n.kind === 'folder' ? (
          folder(n.folder)
        ) : (
          <div key={`u${i}`} className="tile-ungrouped" {...press}>
            {tileViews(n.tiles)}
          </div>
        ),
      )}
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
      // Folders inside folders: the same press reaches each folder's handler; keep only one timer.
      clearTimeout(timer.current)
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
