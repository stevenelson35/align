import { useState } from 'react'
import { addTaskNow, updateTask } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { List, Task } from '../../types'
import { audienceOf } from '../../utils/audience'
import { canAddIdeas, cleanGift, recipientLabel } from '../../utils/gifts'
import { giftAfterMove, giftsLinking, hasGiftDetails, noteFromGift, noteReachWarning } from '../../utils/giftNotes'
import { Icon } from '../UI/Icon'

const NOTE_LIST_KEY = 'align-gift-note-list'
const GIFT_LIST_KEY = 'align-note-gift-list'

const byName = (a: List, b: List) => a.name.localeCompare(b.name)
const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))
/** The last list picked here (remembered on this device), if it's still one of the choices; else the first. */
const remembered = (key: string, choices: List[]) => {
  const last = localStorage.getItem(key)
  return choices.some((l) => l.id === last) ? last! : choices[0]?.id ?? ''
}

/**
 * On a gift idea: "Make it a note…" moves its description, links and pictures (and size and color, as a line) into a
 * new note in one of your notes lists ("Steve's clothes"); the idea keeps its name, how many, price, place and claims,
 * and links to the note, which opens with everything in it. So the details live once and other lists can link them.
 */
export function MakeItANote({ item, list }: { item: Task; list: List }) {
  const app = useApp()
  const { lists } = useData()
  const noteLists = lists.filter((l) => l.kind === 'notes' && app.canEdit(l)).sort(byName)
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState(() => remembered(NOTE_LIST_KEY, noteLists))
  const [title, setTitle] = useState(item.title)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!app.canEdit(item) || !hasGiftDetails(item) || !noteLists.length || (item.noteIds?.length ?? 0) >= 10) return null
  const noteList = noteLists.find((l) => l.id === target)
  const warning = noteList ? noteReachWarning(audienceOf(noteList), audienceOf(list)) : ''

  async function move() {
    if (!noteList || !title.trim()) return
    setBusy(true)
    setError(null)
    try {
      const note = noteFromGift({ ...item, title: title.trim() })
      const { id, written } = addTaskNow(noteList, { ...note, priority: 2, status: 'todo', context: noteList.defaultContext, durationDays: 1, dependsOn: [] }, app.uid)
      await written
      // The pictures move with their references (not deleted here: the note has them now).
      await updateTask(item.id, giftAfterMove(item, id))
      localStorage.setItem(NOTE_LIST_KEY, noteList.id)
      setOpen(false)
    } catch (err) {
      setError(errorText(err))
    }
    setBusy(false)
  }

  if (!open)
    return (
      <p className="gift-note-action">
        <button type="button" className="link small" onClick={() => setOpen(true)}>
          <Icon name="note" /> Make it a note…
        </button>{' '}
        <span className="muted small">keep these details in a note other gift lists can use too</span>
      </p>
    )
  return (
    <div className="gift-note-form card">
      <h4>
        <Icon name="note" /> Make it a note
      </h4>
      <p className="muted small">
        The description, links and pictures (and size and color, as a line) move into a new note. This idea keeps its name, how many, price, place on the list and
        claims, and links to the note, which opens here with all of it.
      </p>
      <label className="small">
        Note
        <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="The note's name" />
      </label>
      <label className="small">
        In
        <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Notes list">
          {noteLists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      {warning && <p className="warning small">Careful: {warning}.</p>}
      {error && <p className="error small">{error}</p>}
      <div className="row">
        <button type="button" className="small" onClick={() => void move()} disabled={busy || !title.trim() || !noteList}>
          {busy ? 'Moving…' : 'Move into the note'}
        </button>
        <button type="button" className="link small" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}

/**
 * On a note: the gift ideas that link to it (each opens), and "Add to a gift list…", which puts an idea on a gift list
 * you can add to, named like the note and linking it (no copy: the note stays the one place for the details).
 */
export function AddToGiftList({ note, noteList }: { note: Task; noteList: List }) {
  const app = useApp()
  const { lists, listItems } = useData()
  const giftLists = lists.filter((l) => l.kind === 'gifts' && !l.giftSecret && canAddIdeas(l, app.member.role, app.canEdit(l))).sort(byName)
  const linked = giftsLinking(note.id, listItems, new Set(lists.filter((l) => l.kind === 'gifts').map((l) => l.id)))
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState(() => remembered(GIFT_LIST_KEY, giftLists))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!app.canPlay || (!giftLists.length && !linked.length)) return null
  const giftList = giftLists.find((l) => l.id === target)
  const listName = (l: List) => `${l.name} (for ${recipientLabel(l, app.household)})`
  const warning = giftList ? noteReachWarning(audienceOf(noteList), audienceOf(giftList)) : ''
  const already = !!giftList && linked.some((t) => t.listId === giftList.id)

  async function add() {
    if (!giftList) return
    setBusy(true)
    setError(null)
    try {
      await addTaskNow(
        giftList,
        { title: note.title, noteIds: [note.id], gift: cleanGift({}), priority: 2, status: 'todo', context: giftList.defaultContext, durationDays: 1, dependsOn: [] },
        app.uid,
      ).written
      localStorage.setItem(GIFT_LIST_KEY, giftList.id)
      setOpen(false)
    } catch (err) {
      setError(errorText(err))
    }
    setBusy(false)
  }

  return (
    <div className="gift-note-links">
      {linked.length > 0 && (
        <p className="small">
          <Icon name="gift" /> On gift lists:{' '}
          {linked.map((t, i) => (
            <span key={t.id}>
              {i > 0 && ', '}
              <button type="button" className="link small inline-link" onClick={() => app.selectTask(t.id)}>
                {lists.find((l) => l.id === t.listId)?.name ?? 'a gift list'}
              </button>
            </span>
          ))}
        </p>
      )}
      {giftLists.length > 0 &&
        (open ? (
          <div className="gift-note-form card">
            <h4>
              <Icon name="gift" /> Add to a gift list
            </h4>
            <p className="muted small">A gift idea named “{note.title}” that links to this note, so its details, links and pictures show there (no copy to keep up to date).</p>
            <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Gift list">
              {giftLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {listName(l)}
                </option>
              ))}
            </select>
            {already && <p className="muted small">It’s on this list already; adding makes a second idea.</p>}
            {warning && <p className="warning small">Careful: {warning}.</p>}
            {error && <p className="error small">{error}</p>}
            <div className="row">
              <button type="button" className="small" onClick={() => void add()} disabled={busy || !giftList}>
                {busy ? 'Adding…' : 'Add'}
              </button>
              <button type="button" className="link small" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="gift-note-action">
            <button type="button" className="link small" onClick={() => setOpen(true)}>
              <Icon name="gift" /> Add to a gift list…
            </button>
          </p>
        ))}
    </div>
  )
}
