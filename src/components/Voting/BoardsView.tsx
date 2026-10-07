import { useState, type FormEvent } from 'react'
import { createBoard, STARTER_BOARDS } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import { useTokenBalance } from '../../hooks/useVoting'

export function BoardsView() {
  const app = useApp()
  const { boards, items } = useData()
  const balance = useTokenBalance()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const id = await createBoard(name.trim())
      setName('')
      app.navigate({ view: 'board', boardId: id })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function addStarters() {
    try {
      for (const n of STARTER_BOARDS) await createBoard(n)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <section>
      <header className="view-header">
        <h2>Voting</h2>
        <span className="grow" />
        {app.isMember && <span className="badge tokens">🪙 {balance} tokens</span>}
      </header>
      {app.isMember && (
        <p className="muted small">
          Everyone gets {app.household.weeklyTokens} tokens a week, and unused tokens roll over. Tokens on a chosen item are spent; archived items give them back.
        </p>
      )}
      <div className="board-grid">
        {boards.map((b) => {
          const open = items.filter((i) => i.boardId === b.id && i.status === 'open').length
          return (
            <button key={b.id} type="button" className="card board-card" onClick={() => app.navigate({ view: 'board', boardId: b.id })}>
              <strong>{b.name}</strong>
              <span className="muted small">{open} open</span>
            </button>
          )
        })}
      </div>
      {boards.length === 0 && app.isMember && (
        <p>
          No boards yet.{' '}
          <button type="button" className="secondary small" onClick={addStarters}>
            Add the starter boards
          </button>
        </p>
      )}
      {app.isMember && (
        <form className="row add-task" onSubmit={add}>
          <input placeholder="New board name…" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit">Add board</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  )
}
