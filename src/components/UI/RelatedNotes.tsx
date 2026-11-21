import type { Task } from '../../types'
import { useApp, useData } from '../../hooks/useApp'
import { audienceLabel, audienceOf } from '../../utils/audience'
import { detailsOf } from '../../utils/details'
import { DetailsView } from './Details'
import { Icon } from './Icon'

/** Notes you can see, A–Z within their notes lists, for linking. */
function useNotes() {
  const { lists, listItems } = useData()
  const noteLists = new Map(lists.filter((l) => l.kind === 'notes').map((l) => [l.id, l]))
  const notes = listItems.filter((t) => noteLists.has(t.listId)).sort((a, b) => a.title.localeCompare(b.title))
  return { notes, noteLists }
}

/**
 * The notes an entry refers to (a gift → "Steve's clothes sizes"): each opens in place to show all of it (text, links,
 * pictures), with Open for the note itself. A note you can't see (private to someone else, or deleted) says so.
 * `open`: start them open (a gift idea whose details live in its note).
 */
export function RelatedNotes({ noteIds, open = false }: { noteIds?: string[]; open?: boolean }) {
  const app = useApp()
  const { notes } = useNotes()
  if (!noteIds?.length) return null
  return (
    <div className="entry-section related-notes">
      <h4>
        <Icon name="note" /> Related notes
      </h4>
      {noteIds.map((id) => {
        const note = notes.find((n) => n.id === id)
        if (!note) return <p key={id} className="muted small">A note you can’t see (it’s private, or was deleted).</p>
        return (
          <details key={id} className="related-note" open={open}>
            <summary>{note.title}</summary>
            <RelatedNoteBody note={note} />
            <button type="button" className="link small" onClick={() => app.selectTask(note.id)}>
              Open the note
            </button>
          </details>
        )
      })}
    </div>
  )
}

/** A linked note's text, links and pictures, the way the note itself shows them. */
function RelatedNoteBody({ note }: { note: Task }) {
  const d = detailsOf(note, false)
  if (!note.notes && !d.links.length && !d.images.length) return <p className="muted small">(nothing written yet)</p>
  return <DetailsView note={note.notes} links={d.links} images={d.images} alt={note.title} />
}

/**
 * Link notes in an edit form: the linked ones (✕ removes) and a picker of every note you can see. Warns when a
 * linked note is seen by fewer people than the entry (e.g. a private note on a family gift list).
 */
export function NotePicker({ value, onChange, audience }: { value: string[]; onChange: (ids: string[]) => void; /** Who sees the entry, to warn about narrower notes. */ audience?: string }) {
  const { lists } = useData()
  const { notes, noteLists } = useNotes()
  const chosen = new Set(value)
  const byList = [...noteLists.values()].sort((a, b) => a.name.localeCompare(b.name)).map((l) => ({ list: l, notes: notes.filter((n) => n.listId === l.id && !chosen.has(n.id)) }))
  const narrower = (id: string) => {
    const note = notes.find((n) => n.id === id)
    const list = note && lists.find((l) => l.id === note.listId)
    if (!list || !audience) return ''
    const a = audienceOf(list)
    return a === 'private' && audience !== 'private' ? 'only you can see this note' : a !== 'everyone' && a !== 'family' && audience !== a ? `seen by ${audienceLabel(a).toLowerCase()} only` : ''
  }
  return (
    <div className="note-picker">
      <span className="label">Related notes</span>
      {value.length > 0 && (
        <ul className="note-picker-chosen">
          {value.map((id) => {
            const note = notes.find((n) => n.id === id)
            const warn = narrower(id)
            return (
              <li key={id} className="row">
                <Icon name="note" />
                <span className="grow">
                  {note?.title ?? 'A note you can’t see'}
                  {warn && <span className="muted small"> ({warn})</span>}
                </span>
                <button type="button" className="link small" onClick={() => onChange(value.filter((x) => x !== id))} aria-label={`Unlink ${note?.title ?? 'note'}`}>
                  <Icon name="close" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {notes.length > value.length && value.length < 10 ? (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) onChange([...value, e.target.value])
          }}
          aria-label="Link a note"
        >
          <option value="">Link a note (sizes, preferences, instructions…)</option>
          {byList
            .filter((g) => g.notes.length)
            .map((g) => (
              <optgroup key={g.list.id} label={g.list.name}>
                {g.notes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </optgroup>
            ))}
        </select>
      ) : (
        !notes.length && <span className="muted small">No notes yet: make a Notes list to keep sizes, preferences and the like, then link them here.</span>
      )}
    </div>
  )
}
