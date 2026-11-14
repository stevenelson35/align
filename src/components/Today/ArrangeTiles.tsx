import { useRef, useState } from 'react'
import { useApp } from '../../hooks/useApp'
import { useTodayTiles } from '../../hooks/useTodayTiles'
import { addGroup, closeGroup, defaultTiles, runsToMore, placeOf, isMark, moveTile, newGroupName, parseTile, removeTile, renameGroup, type Tile } from '../../utils/tiles'
import { Icon } from '../UI/Icon'
import { TileGapSetting } from './TileGapSetting'
import { useTileInfo } from './useTileInfo'

/**
 * Arranging Today: every tile in order, the More… line among them (what's below it is folded into More…). Drag a
 * tile by its handle (or use ↑ ↓), ✕ takes it off Today (it stays in its list); groups are headings you name.
 * Saved for you on every device.
 */
export function ArrangeTiles({ onDone, onAdd }: { onDone: () => void; onAdd: () => void }) {
  const { member } = useApp()
  const today = useTodayTiles()
  const info = useTileInfo()
  const [error, setError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null)
  // While dragging: the order as it is under the finger (saved when let go).
  const [dragOrder, setDragOrder] = useState<Tile[] | null>(null)
  const dragging = useRef<Tile | null>(null)
  const [held, setHeld] = useState<Tile | null>(null)
  const box = useRef<HTMLOListElement>(null)
  const tiles = dragOrder ?? today.tiles
  const fail = (err: unknown) => setError(err instanceof Error ? err.message : String(err))
  const save = (next: Tile[]) => {
    setError(null)
    today.save(next).catch(fail)
  }
  const move = (from: number, to: number) => save(moveTile(tiles, from, to))

  function dragTo(y: number) {
    const t = dragging.current
    const rows = box.current ? [...box.current.querySelectorAll<HTMLElement>('[data-tile]')] : []
    if (!t || !rows.length) return
    // Where it belongs: after every other row whose middle is above the finger.
    const others = rows.filter((r) => r.dataset.tile !== t)
    const to = others.filter((r) => {
      const b = r.getBoundingClientRect()
      return b.top + b.height / 2 < y
    }).length
    const from = tiles.indexOf(t)
    if (from !== to) setDragOrder(moveTile(tiles, from, to))
    // Near the top or bottom of the screen: scroll, so a tile can go anywhere.
    if (y < 70) window.scrollBy(0, -12)
    else if (y > window.innerHeight - 90) window.scrollBy(0, 12)
  }

  const handle = (t: Tile, label: string) => ({
    className: 'drag-handle',
    'aria-hidden': true as const,
    title: `Drag ${label}`,
    onPointerDown: (e: React.PointerEvent<HTMLSpanElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      dragging.current = t
      setHeld(t)
      setDragOrder(today.tiles)
    },
    onPointerMove: (e: React.PointerEvent) => dragging.current && dragTo(e.clientY),
    onPointerUp: () => {
      const order = dragOrder
      dragging.current = null
      setHeld(null)
      setDragOrder(null)
      if (order && order.join('\n') !== today.tiles.join('\n')) save(order)
    },
    onPointerCancel: () => {
      dragging.current = null
      setHeld(null)
      setDragOrder(null)
    },
  })

  return (
    <div className="day-section arrange-tiles">
      <h3 className="row">
        <span className="grow">Arrange Today</span>
        <button type="button" className="secondary small" onClick={onAdd}>
          <Icon name="plus" /> Add…
        </button>
        <button type="button" className="secondary small" onClick={() => { const name = newGroupName(tiles); save(addGroup(tiles, name)); setRenaming({ from: name, to: name }) }} title="A heading you name, added just above the More… line; drag tiles under it">
          New group
        </button>
        <button type="button" className="small" onClick={onDone}>
          Done
        </button>
      </h3>
      <p className="muted small">
        Drag ⠿ to move (or ↑ ↓). Tiles between a group and its end line are in the group; below the end line they aren’t. Below the More… line is folded into More…. ✕
        only takes it off Today. Pin more with Add…, or “Pin to Today” on any entry or list.
      </p>
      <TileGapSetting />
      <ol className="arrange-list" ref={box}>
        {tiles.map((t, i) => {
          if (isMark(t)) return null // a panel you took off for good (kept so it isn't added back)
          const { kind, id } = parseTile(t)
          const inGroup = kind !== 'group' && kind !== 'more' && kind !== 'end' && placeOf(tiles, t)?.group !== undefined
          if (kind === 'end')
            return (
              <li key={t} data-tile={t} className={`arrange-more arrange-end${held === t ? ' dragging' : ''}`}>
                <span {...handle(t, 'the end of the group')}>⠿</span>
                <span className="grow">End of group (below: not in a group)</span>
                <button type="button" className="row-action" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Move the end of the group up" title="Move up">↑</button>
                <button type="button" className="row-action" disabled={i === tiles.length - 1} onClick={() => move(i, i + 1)} aria-label="Move the end of the group down" title="Move down">↓</button>
                <button type="button" className="row-action" onClick={() => save(tiles.filter((x) => x !== t))} aria-label="Remove the end of the group" title="Remove (the group then runs to the next group or the More… line)">
                  <Icon name="close" />
                </button>
              </li>
            )
          if (kind === 'more')
            return (
              <li key={t} data-tile={t} className={`arrange-more${held === t ? ' dragging' : ''}`}>
                <span {...handle(t, 'the More… line')}>⠿</span>
                <span className="grow">Below here: in More…</span>
                <button type="button" className="row-action" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Move the More… line up" title="Move up">↑</button>
                <button type="button" className="row-action" disabled={i === tiles.length - 1} onClick={() => move(i, i + 1)} aria-label="Move the More… line down" title="Move down">↓</button>
              </li>
            )
          const it = info(t)
          return (
            <li key={t} data-tile={t} className={`arrange-row${kind === 'group' ? ' arrange-group' : ''}${inGroup ? ' in-group' : ''}${it.missing ? ' missing' : ''}${held === t ? ' dragging' : ''}`}>
              <span {...handle(t, it.label)}>⠿</span>
              {kind === 'group' && renaming?.from === id ? (
                <form
                  className="row grow"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const next = renameGroup(tiles, id, renaming.to)
                    if (next === tiles && renaming.to.trim() !== id) return setError(renaming.to.trim() ? `There’s already a group called “${renaming.to.trim()}”.` : 'A group needs a name.')
                    setError(null)
                    if (next !== tiles) save(next)
                    setRenaming(null)
                  }}
                >
                  <input autoFocus value={renaming.to} maxLength={40} onChange={(e) => setRenaming({ from: id, to: e.target.value })} onKeyDown={(e) => e.key === 'Escape' && setRenaming(null)} aria-label="Group name" />
                  <button type="submit" className="small">Save</button>
                </form>
              ) : (
                <span className="grow arrange-label">
                  <Icon name={it.icon} /> {kind === 'group' ? <strong>{it.label}</strong> : it.label} <span className="muted small">{it.kind}</span>
                  {kind === 'group' && (
                    <button type="button" className="link small" onClick={() => setRenaming({ from: id, to: id })}>
                      Rename
                    </button>
                  )}
                  {kind === 'group' && runsToMore(tiles, i) && (
                    <button type="button" className="link small" onClick={() => save(closeGroup(tiles, i))} title="Add an end line after its last tile, so tiles can go below the group">
                      Add end line
                    </button>
                  )}
                </span>
              )}
              <button type="button" className="row-action" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move ${it.label} up`} title="Move up">↑</button>
              <button type="button" className="row-action" disabled={i === tiles.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move ${it.label} down`} title="Move down">↓</button>
              <button type="button" className="row-action" onClick={() => save(removeTile(tiles, t))} aria-label={`Take ${it.label} off Today`} title={kind === 'group' ? 'Remove the heading (its tiles stay)' : 'Take off Today'}>
                <Icon name="close" />
              </button>
            </li>
          )
        })}
      </ol>
      {member.today && (
        <button
          type="button"
          className="link small"
          onClick={() => window.confirm('Put Today back the way it started (your pins and groups go)?') && save(defaultTiles(member))}
        >
          Back to the usual arrangement
        </button>
      )}
      {error && <p className="error small">{error}</p>}
    </div>
  )
}
