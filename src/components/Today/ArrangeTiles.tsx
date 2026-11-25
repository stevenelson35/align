import { useRef, useState } from 'react'
import { useApp } from '../../hooks/useApp'
import { useTodayTiles } from '../../hooks/useTodayTiles'
import { addGroup, addSubgroup, closeGroup, defaultTiles, folderLabel, groupNames, leafName, runsToMore, placeOf, isMark, moveTile, moveToFolder, newGroupName, parseTile, removeTile, renameGroup, FOLDER_SEP, type Tile } from '../../utils/tiles'
import { WAITABLE } from '../../hooks/useWaiting'
import { Icon } from '../UI/Icon'
import { TileGapSetting } from './TileGapSetting'
import { useTileInfo } from './useTileInfo'

/**
 * Arranging Home: every tile in order, the More… line among them (what's below it is folded into More…). Drag a
 * tile by its handle (or use ↑ ↓), or "Move to…" a folder; ✕ takes it off Home (it stays in its list). Folders are
 * headings you name, and can hold folders ("New folder inside"). Some tiles can show only when something's new.
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
  const folders = groupNames(tiles)
  // How deep a row sits: a folder by its name's levels; a tile one more than its folder.
  const depth = (t: Tile, kind: string, id: string) => {
    if (kind === 'group') return id.split(FOLDER_SEP).length - 1
    const g = placeOf(tiles, t)?.group
    return g === undefined ? 0 : g.split(FOLDER_SEP).length
  }
  const startRename = (name: string) => setRenaming({ from: name, to: leafName(name) })

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
        <span className="grow">Arrange Home</span>
        <button type="button" className="secondary small" onClick={onAdd}>
          <Icon name="plus" /> Add…
        </button>
        <button type="button" className="secondary small" onClick={() => { const name = newGroupName(tiles, 'Folder'); save(addGroup(tiles, name)); startRename(name) }} title="A folder you name, added just above the More… line; move tiles into it">
          <Icon name="folder" /> New folder
        </button>
        <button type="button" className="small" onClick={onDone}>
          Done
        </button>
      </h3>
      <p className="muted small">
        Drag ⠿ to move (or ↑ ↓), or pick a folder in “Move to”. Folders can hold folders (New folder inside). Below the More… line is folded into More…. “When
        something’s new” keeps a tile off Home until there’s something waiting there. ✕ only takes it off Home. Pin more with Add…, or “Pin to Today” on any entry or list.
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
                <span className="grow">End of folder (below: not in a folder)</span>
                <button type="button" className="row-action" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Move the end of the folder up" title="Move up">↑</button>
                <button type="button" className="row-action" disabled={i === tiles.length - 1} onClick={() => move(i, i + 1)} aria-label="Move the end of the folder down" title="Move down">↓</button>
                <button type="button" className="row-action" onClick={() => save(tiles.filter((x) => x !== t))} aria-label="Remove the end of the folder" title="Remove (the folder then runs to the next folder or the More… line)">
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
            <li
              key={t}
              data-tile={t}
              className={`arrange-row${kind === 'group' ? ' arrange-group' : ''}${inGroup ? ' in-group' : ''}${it.missing ? ' missing' : ''}${held === t ? ' dragging' : ''}`}
              style={{ '--depth': depth(t, kind, id) } as React.CSSProperties}
            >
              <span {...handle(t, it.label)}>⠿</span>
              {kind === 'group' && renaming?.from === id ? (
                <form
                  className="row grow"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const next = renameGroup(tiles, id, renaming.to)
                    if (next === tiles && renaming.to.trim() !== leafName(id)) return setError(renaming.to.trim() ? `There’s already a folder called “${renaming.to.trim()}” there.` : 'A folder needs a name.')
                    setError(null)
                    if (next !== tiles) save(next)
                    setRenaming(null)
                  }}
                >
                  <input autoFocus value={renaming.to} maxLength={40} onChange={(e) => setRenaming({ from: id, to: e.target.value })} onKeyDown={(e) => e.key === 'Escape' && setRenaming(null)} aria-label="Folder name" />
                  <button type="submit" className="small">Save</button>
                </form>
              ) : (
                <span className="grow arrange-label">
                  <Icon name={it.icon} /> {kind === 'group' ? <strong>{leafName(id)}</strong> : it.label} <span className="muted small">{kind === 'group' ? 'Folder' : it.kind}</span>
                  {kind === 'group' && (
                    <>
                      <button type="button" className="link small" onClick={() => startRename(id)}>
                        Rename
                      </button>
                      <button
                        type="button"
                        className="link small"
                        onClick={() => {
                          const leaf = newGroupName(tiles.map((x) => (x.startsWith(`group:${id}${FOLDER_SEP}`) ? `group:${x.slice(7 + id.length)}` : x)), 'Folder')
                          save(addSubgroup(tiles, id, leaf))
                          startRename(`${id}${FOLDER_SEP}${leaf}`)
                        }}
                      >
                        New folder inside
                      </button>
                    </>
                  )}
                  {kind === 'group' && runsToMore(tiles, i) && (
                    <button type="button" className="link small" onClick={() => save(closeGroup(tiles, i))} title="Add an end line after its last tile, so tiles can go below the folder">
                      Add end line
                    </button>
                  )}
                  {kind !== 'group' && (
                    <span className="arrange-options">
                      <label className="small">
                        Move to{' '}
                        <select
                          value={placeOf(tiles, t)?.more ? ':more' : (placeOf(tiles, t)?.group ?? '')}
                          onChange={(e) => save(moveToFolder(tiles, t, e.target.value === ':more' ? 'more' : e.target.value || null))}
                          aria-label={`Move ${it.label} to`}
                        >
                          <option value="">Home (no folder)</option>
                          {folders.map((f) => (
                            <option key={f} value={f}>
                              {folderLabel(f)}
                            </option>
                          ))}
                          <option value=":more">More…</option>
                        </select>
                      </label>
                      {t in WAITABLE && (
                        <label className="small" title={`When something's new: only when there's ${WAITABLE[t]}`}>
                          Show{' '}
                          <select value={today.whenNew.has(t) ? 'new' : 'always'} onChange={(e) => today.setWhenNew(t, e.target.value === 'new').catch(fail)} aria-label={`When to show ${it.label}`}>
                            <option value="always">Always</option>
                            <option value="new">When something’s new</option>
                          </select>
                        </label>
                      )}
                    </span>
                  )}
                </span>
              )}
              <button type="button" className="row-action" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move ${it.label} up`} title="Move up">↑</button>
              <button type="button" className="row-action" disabled={i === tiles.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move ${it.label} down`} title="Move down">↓</button>
              <button type="button" className="row-action" onClick={() => save(removeTile(tiles, t))} aria-label={`Take ${it.label} off Home`} title={kind === 'group' ? 'Remove the folder (what’s in it stays, one level up)' : 'Take off Home'}>
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
          onClick={() => window.confirm('Put Home back the way it started (your pins and folders go)?') && save(defaultTiles())}
        >
          Back to the usual arrangement
        </button>
      )}
      {error && <p className="error small">{error}</p>}
    </div>
  )
}
