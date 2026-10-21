import { useState, type FormEvent } from 'react'
import { createItem, setItemStatus, setVote, updateBoard } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import { useBoardVotes, useTokenBalance } from '../../hooks/useVoting'
import type { Board, BoardItem, ItemStatus } from '../../types'
import { safeUrl } from '../../utils/links'
import { Comments } from './Comments'
import { ItemDetail } from './ItemDetail'
import { Icon } from '../UI/Icon'

export function BoardView({ board }: { board: Board }) {
  const app = useApp()
  const { items: allItems } = useData()
  const balance = useTokenBalance()
  const [title, setTitle] = useState('')
  const [showClosed, setShowClosed] = useState(false)
  const [openItem, setOpenItem] = useState<string | null>(null) // the item showing its details and comments
  const toggleItem = (id: string) => setOpenItem((o) => (o === id ? null : id))
  /** The title as a button that opens the item, with small marks for what it holds. */
  const itemTitle = (item: BoardItem) => (
    <button type="button" className="item-title" onClick={() => toggleItem(item.id)} aria-expanded={openItem === item.id} title="Details and comments">
      {safeUrl(item.imageUrl) && <img src={safeUrl(item.imageUrl)!} alt="" className="item-thumb" loading="lazy" />}
      <strong>{item.title}</strong>
      {item.note && <span title="Has a note"> <Icon name="note" /></span>}
      {item.url && <span title="Has a link"> <Icon name="link" /></span>}
      <span className="muted small"> {openItem === item.id ? '▾' : '▸'}</span>
    </button>
  )
  const [error, setError] = useState<string | null>(null)

  const items = allItems.filter((i) => i.boardId === board.id)
  const votes = useBoardVotes(
    board.id,
    items.map((i) => i.id),
  )
  const total = (i: BoardItem) => (votes.get(i.id) ?? []).reduce((s, v) => s + v.tokens, 0)
  const mine = (i: BoardItem) => votes.get(i.id)?.find((v) => v.uid === app.uid)?.tokens ?? 0
  const ranked = (status: ItemStatus) => items.filter((i) => i.status === status).sort((a, b) => total(b) - total(a))
  const open = ranked('open')
  const maxTotal = Math.max(1, ...open.map(total))

  const run = (p: Promise<unknown>) => p.catch((err) => setError(err instanceof Error ? err.message : String(err)))

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await run(createItem(board.id, title.trim(), app.uid))
    setTitle('')
  }

  function vote(item: BoardItem, delta: number) {
    const next = mine(item) + delta
    if (next < 0) return
    // The client blocks overspending; the rules trust the family (DESIGN.md §7).
    if (delta > 0 && balance < delta) {
      setError("You're out of tokens until next week.")
      return
    }
    setError(null)
    run(setVote(board.id, item.id, app.uid, next))
  }

  function bar(item: BoardItem) {
    const vs = votes.get(item.id) ?? []
    return (
      <div className="vote-bar" style={{ width: `${(100 * total(item)) / maxTotal}%` }}>
        {vs.map((v) => (
          <span
            key={v.uid}
            style={{ flex: v.tokens, background: app.household.members[v.uid]?.color ?? 'var(--muted)' }}
            title={`${app.household.members[v.uid]?.displayName ?? 'Someone'}: ${v.tokens}`}
          />
        ))}
      </div>
    )
  }

  return (
    <section>
      <header className="view-header">
        <h2>{board.name}</h2>
        <span className="grow" />
        {app.isMember && <span className="badge tokens"><Icon name="coin" /> {balance} left</span>}
      </header>
      {app.isMember && (
        <label className="inline small">
          Who can see it
          {/* Boards belong to the whole household, so they offer the two household-wide choices. */}
          <select value={board.viewerVisible ? 'everyone' : 'family'} onChange={(e) => run(updateBoard(board, { viewerVisible: e.target.value === 'everyone' }))}>
            <option value="family">Family</option>
            <option value="everyone">Everyone</option>
          </select>
        </label>
      )}

      <div className="items">
        {open.map((item, rank) => (
          <div key={item.id} className="card item-row">
            <span className="rank">{rank + 1}</span>
            <div className="grow">
              <div className="row">
                <span className="grow">{itemTitle(item)}</span>
                <span className="muted small">{total(item)} tokens</span>
              </div>
              {bar(item)}
              {openItem === item.id && <ItemDetail key={item.id + JSON.stringify([item.title, item.note, item.url, item.imageUrl])} item={item} />}
            </div>
            {app.isMember && (
              <div className="vote-controls">
                <button type="button" className="secondary small" onClick={() => vote(item, -1)} disabled={mine(item) === 0} aria-label="Remove a token">
                  −
                </button>
                <span className="mine" title="Your tokens">
                  {mine(item)}
                </span>
                <button type="button" className="small" onClick={() => vote(item, 1)} aria-label="Add a token">
                  +
                </button>
                <button type="button" className="link small" onClick={() => run(setItemStatus(item, 'chosen'))} title="We did it: tokens are spent">
                  ✓ Chosen
                </button>
                <button type="button" className="link small" onClick={() => run(setItemStatus(item, 'archived'))} title="Drop it: tokens come back">
                  Archive
                </button>
              </div>
            )}
          </div>
        ))}
        {open.length === 0 && <p className="muted">No open items.</p>}
      </div>

      {app.isMember && (
        <form className="row add-task" onSubmit={add}>
          <input placeholder="Suggest something…" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button type="submit">Add</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}

      {(ranked('chosen').length > 0 || ranked('archived').length > 0) && (
        <button type="button" className="link" onClick={() => setShowClosed((s) => !s)}>
          {showClosed ? 'Hide' : 'Show'} chosen and archived
        </button>
      )}
      {showClosed &&
        (['chosen', 'archived'] as const).map((status) => (
          <div key={status}>
            <h3>{status === 'chosen' ? 'Chosen' : 'Archived'}</h3>
            {ranked(status).map((item) => (
              <div key={item.id} className="item-closed">
                <div className="row">
                <span className="grow">{itemTitle(item)}</span>
                <span className="muted small">{total(item)} tokens</span>
                {app.isMember && (
                  <button type="button" className="link small" onClick={() => run(setItemStatus(item, 'open'))}>
                    Reopen
                  </button>
                )}
                </div>
                {openItem === item.id && <ItemDetail item={item} />}
              </div>
            ))}
          </div>
        ))}
      <div className="board-discussion">
        <h3><Icon name="message" /> Discussion</h3>
        <Comments boardId={board.id} placeholder="Say something about this board…" />
      </div>
    </section>
  )
}
