import { useEffect, useState, type FormEvent } from 'react'
import { addComment, deleteComment, editComment, subscribeComments } from '../../firebase/db'
import { useApp } from '../../hooks/useApp'
import type { Comment } from '../../types'
import { targetName } from '../../utils/tasks'

function when(c: Comment): string {
  if (!c.createdAt) return 'just now'
  return new Date(c.createdAt.seconds * 1000).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** Comments on a board (no itemId) or on one item: everyone who can see the board reads; members write. */
export function Comments({ boardId, itemId, placeholder = 'Add a comment…' }: { boardId: string; itemId?: string; placeholder?: string }) {
  const { uid, isMember, household } = useApp()
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => subscribeComments(boardId, itemId, setComments, (e) => setError(e.message)), [boardId, itemId])
  const fail = (err: unknown) => setError(err instanceof Error ? err.message : String(err))

  function add(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    setText('') // clear at once; the comment shows immediately
    addComment(boardId, itemId, t, uid).catch((err) => {
      fail(err)
      setText(t)
    })
  }

  return (
    <div className="comments">
      {comments === null && <p className="muted small">Loading comments…</p>}
      {comments?.map((c) => (
        <div key={c.id} className="comment">
          <div className="comment-head small">
            <strong>{c.uid === uid ? 'You' : targetName(c.uid, household)}</strong>
            <span className="muted">
              {when(c)}
              {c.edited && ' · edited'}
            </span>
            {c.uid === uid && editing?.id !== c.id && (
              <>
                <button type="button" className="link small" onClick={() => setEditing({ id: c.id, text: c.text })}>
                  Edit
                </button>
                <button type="button" className="link small" onClick={() => window.confirm('Delete this comment?') && deleteComment(boardId, itemId, c.id).catch(fail)}>
                  Delete
                </button>
              </>
            )}
          </div>
          {editing?.id === c.id ? (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault()
                if (editing.text.trim()) editComment(boardId, itemId, c, editing.text).catch(fail)
                setEditing(null)
              }}
            >
              <input value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} maxLength={2000} aria-label="Edit comment" />
              <button type="submit" className="small">
                Save
              </button>
              <button type="button" className="link small" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </form>
          ) : (
            <div className="comment-text">{c.text}</div>
          )}
        </div>
      ))}
      {comments?.length === 0 && <p className="muted small">No comments yet.</p>}
      {isMember && (
        <form className="row" onSubmit={add}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} maxLength={2000} aria-label="New comment" />
          <button type="submit" className="small">
            Post
          </button>
        </form>
      )}
      {error && <p className="error small">{error}</p>}
    </div>
  )
}
