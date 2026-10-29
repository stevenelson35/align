import { useState, type ReactNode } from 'react'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import type { HelpTopicId } from '../../help/topics'
import type { IconName } from './Icon'
import { SectionHeader } from './SectionHeader'

/**
 * One Today section in the shared shape: your pinned items first, then a search box (with any filters), then Show
 * all, which lists everything right here (rows, or cards where offered). Folded until opened; open, the list view
 * and rows / cards are remembered on this device.
 */
export function CollectionSection<T>({
  id,
  title,
  icon,
  help,
  count,
  actions,
  items,
  pinned,
  itemKey,
  matches,
  render,
  filters,
  searchHint,
  allowCards = false,
  empty,
}: {
  /** For remembering open / rows-or-cards on this device. */
  id: string
  title: string
  icon: IconName
  help?: HelpTopicId
  count?: ReactNode
  /** Links on the header's right (e.g. "All contacts"). */
  actions?: ReactNode
  /** Everything the section can list (already filtered by any filters), in display order. */
  items: T[]
  /** Your pinned ones, shown first. */
  pinned: T[]
  itemKey: (item: T) => string
  matches: (item: T, query: string) => boolean
  render: (item: T, mode: 'row' | 'card') => ReactNode
  filters?: ReactNode
  searchHint: string
  allowCards?: boolean
  /** Shown when there's nothing at all. */
  empty?: ReactNode
}) {
  const [open, setOpen] = useStoredFlag(`align-today-${id}`, false)
  const [cards, setCards] = useStoredFlag(`align-today-${id}-cards`, false)
  const [query, setQuery] = useState('')
  const [all, setAll] = useState(false)
  const mode = allowCards && cards ? 'card' : 'row'
  const q = query.trim()
  const found = q ? items.filter((i) => matches(i, q)) : []
  const list = (rows: T[]) => <div className={mode === 'card' ? 'collection-grid-cards' : 'collection-grid-rows'}>{rows.map((i) => <div key={itemKey(i)}>{render(i, mode)}</div>)}</div>

  return (
    <div className={`day-section collection-section collection-${id}`}>
      <SectionHeader icon={icon} title={title} count={count} onTitleClick={() => setOpen(!open)} expanded={open} help={help}>
        {actions}
        <button type="button" className="link small" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'}
        </button>
      </SectionHeader>
      {open && (
        <>
          {pinned.length > 0 && !q && (
            <>
              <h4 className="collection-label small muted">Pinned</h4>
              {list(pinned)}
            </>
          )}
          <div className="row collection-search">
            <input type="search" className="grow" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchHint} aria-label={`Search ${title.toLowerCase()}`} />
            {allowCards && (
              <span className="collection-modes" role="group" aria-label="Show as">
                <button type="button" className={`link small${mode === 'row' ? ' on' : ''}`} onClick={() => setCards(false)} aria-pressed={mode === 'row'}>
                  Rows
                </button>
                <button type="button" className={`link small${mode === 'card' ? ' on' : ''}`} onClick={() => setCards(true)} aria-pressed={mode === 'card'}>
                  Cards
                </button>
              </span>
            )}
          </div>
          {filters}
          {q ? (
            found.length ? list(found) : <p className="muted small">Nothing matches “{query}”.</p>
          ) : items.length ? (
            <>
              <button type="button" className="link small collection-all" onClick={() => setAll(!all)} aria-expanded={all}>
                {all ? 'Hide the list' : `Show all ${items.length}`}
              </button>
              {all && list(items)}
            </>
          ) : (
            (empty ?? <p className="muted small">Nothing here yet.</p>)
          )}
        </>
      )}
    </div>
  )
}

/** The ☆ / ★ that pins an item to the top of its Today section. */
export function PinButton({ pinned, onToggle, label }: { pinned: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" className={`link small pin-button${pinned ? ' on' : ''}`} onClick={onToggle} aria-pressed={pinned} title={pinned ? `Unpin ${label}` : `Pin ${label} to the top`} aria-label={pinned ? `Unpin ${label}` : `Pin ${label}`}>
      {pinned ? '★' : '☆'}
    </button>
  )
}
