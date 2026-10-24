import { useState, type FormEvent } from 'react'
import { addTaskNow, recordCard, resetCards } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { List, Task } from '../../types'
import { parseCards, resultFor, STUDY_MODES, studyOrder, type Card, type StudyMode } from '../../utils/flashcards'
import { ListHeader } from '../Tasks/ListHeader'
import { Icon } from '../UI/Icon'
import { RevealCard } from '../UI/RevealCard'
import { SectionHeader } from '../UI/SectionHeader'

/** When a card was added, so "In order" follows the order they were added (or imported). */
const added = (t: Task) => (t.createdAt ? t.createdAt.seconds + t.createdAt.nanoseconds / 1e9 : Infinity)

interface Session {
  ids: string[]
  at: number
  right: number
  wrong: number
  mode: StudyMode
}

/**
 * Flashcards (DESIGN.md §5.9): a set of cards (front = the title, back = the note). Study them in order, shuffled,
 * or only the ones you haven't got yet; think, Show answer, then "Got it" or "Not yet" (your own results, kept per
 * person). Add cards one at a time or import many from text or a YAML file.
 */
export function CardsView({ list }: { list: List }) {
  const app = useApp()
  const { listItems } = useData()
  const editable = app.canEdit(list)
  const cards = listItems.filter((t) => t.listId === list.id).sort((a, b) => added(a) - added(b) || a.title.localeCompare(b.title))
  const known = cards.filter((c) => resultFor(c, app.uid).known).length
  const [mode, setMode] = useState<StudyMode>('shuffle')
  const [session, setSession] = useState<Session | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [shuffling, setShuffling] = useState(false)
  const [showBacks, setShowBacks] = useState(false)
  // The page opens on Study alone; "Cards (50)" lists them, and Edit there adds, imports and edits the list. A new,
  // empty set opens ready for adding.
  const [showCards, setShowCards] = useState(false)
  const [editingState, setEditing] = useState(false)
  const editing = editable && (editingState || !cards.length)
  const listing = showCards || editing
  const [error, setError] = useState<string | null>(null)
  const fail = (err: unknown) => setError(err instanceof Error ? err.message : String(err))

  function start(m: StudyMode) {
    const order = studyOrder(cards, m, app.uid, crypto.getRandomValues(new Uint32Array(1))[0])
    if (!order.length) return setError(m === 'unknown' ? 'You’ve got them all. Try Shuffled, or Start over.' : 'Add some cards first.')
    setError(null)
    setRevealed(false)
    const begin = () => setSession({ ids: order.map((c) => c.id), at: 0, right: 0, wrong: 0, mode: m })
    if (m === 'order') return begin()
    // A short shuffle so it's clear the deck was mixed.
    setShuffling(true)
    setTimeout(() => {
      setShuffling(false)
      begin()
    }, 700)
  }

  function answer(card: Task, gotIt: boolean) {
    if (!session) return
    if (app.isMember) recordCard(card.id, app.uid, resultFor(card, app.uid), gotIt).catch(fail)
    setRevealed(false)
    setSession({ ...session, at: session.at + 1, right: session.right + (gotIt ? 1 : 0), wrong: session.wrong + (gotIt ? 0 : 1) })
  }

  const current = session && session.at < session.ids.length ? cards.find((c) => c.id === session.ids[session.at]) : undefined
  const finished = session && session.at >= session.ids.length

  return (
    <section className="cards-view">
      <ListHeader list={list} tools={editing} />

      <div className="day-section">
        <SectionHeader icon="todo" title="Study" count={`${known}/${cards.length} known`} help="cards" />
        {!session && !shuffling && (
          <div className="row wrap">
            <select value={mode} onChange={(e) => setMode(e.target.value as StudyMode)} aria-label="How to study">
              {STUDY_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <button type="button" className="small" onClick={() => start(mode)} disabled={!cards.length}>
              <Icon name="play" /> Start
            </button>
            {known > 0 && app.isMember && (
              <button type="button" className="link small" onClick={() => window.confirm('Forget which cards you know, and start over?') && resetCards(cards.map((c) => c.id), app.uid).catch(fail)}>
                Start over
              </button>
            )}
          </div>
        )}
        {shuffling && (
          <div className="deck shuffling" aria-live="polite" aria-label="Shuffling">
            <span />
            <span />
            <span />
            <p className="muted small">Shuffling…</p>
          </div>
        )}
        {current && session && (
          <>
            <p className="muted small">
              Card {session.at + 1} of {session.ids.length} · ✓ {session.right} · ✗ {session.wrong}
            </p>
            <RevealCard
              key={current.id}
              className="flashcard"
              front={<span className="flash-front">{current.title}</span>}
              back={<span className="flash-back">{current.notes || '(no answer written)'}</span>}
              open={revealed}
              onOpen={() => setRevealed(true)}
              footer={
                revealed && (
                  <div className="row flash-answer">
                    <button type="button" className="small" onClick={() => answer(current, true)}>
                      <Icon name="check" /> Got it
                    </button>
                    <button type="button" className="secondary small" onClick={() => answer(current, false)}>
                      <Icon name="close" /> Not yet
                    </button>
                  </div>
                )
              }
            />
            <div className="row">
              <button type="button" className="link small" onClick={() => setSession({ ...session, at: session.at + 1 })}>
                Skip
              </button>
              <button type="button" className="link small" onClick={() => setSession(null)}>
                Stop
              </button>
            </div>
          </>
        )}
        {finished && session && (
          <div className="flash-summary">
            <p>
              <strong>
                {session.right} of {session.right + session.wrong}
              </strong>{' '}
              right{session.right + session.wrong < session.ids.length ? ` (${session.ids.length - session.right - session.wrong} skipped)` : ''}.
            </p>
            <div className="row wrap">
              {session.wrong > 0 && (
                <button type="button" className="small" onClick={() => start('unknown')}>
                  Study the ones not known yet
                </button>
              )}
              <button type="button" className="secondary small" onClick={() => start(session.mode === 'order' ? 'order' : 'shuffle')}>
                Go again
              </button>
              <button type="button" className="link small" onClick={() => setSession(null)}>
                Done
              </button>
            </div>
          </div>
        )}
        {error && <p className="error small">{error}</p>}
      </div>

      <div className="day-section">
        <SectionHeader icon="list" title="Cards" count={cards.length} onTitleClick={() => setShowCards(!listing)} expanded={listing}>
          {listing && cards.length > 0 && (
            <button type="button" className="link small" onClick={() => setShowBacks(!showBacks)}>
              {showBacks ? 'Hide answers' : 'Show answers'}
            </button>
          )}
          {listing && editable && cards.length > 0 && (
            <button type="button" className="link small" onClick={() => setEditing(!editing)} aria-pressed={editing} title={editing ? 'Done adding and editing' : 'Add cards, import a set, or edit the list'}>
              <Icon name={editing ? 'check' : 'edit'} /> {editing ? 'Done' : 'Edit'}
            </button>
          )}
          {!listing && (
            <button type="button" className="link small" onClick={() => setShowCards(true)} aria-expanded={false}>
              Show
            </button>
          )}
        </SectionHeader>
        {editing && <AddCards list={list} onError={fail} />}
        {listing && (
          <ul className="cards-list">
            {cards.map((c) => {
              const r = resultFor(c, app.uid)
              return (
                <li key={c.id} className={`card-row${app.selectedTaskId === c.id ? ' selected' : ''}`}>
                  <button type="button" className="link card-front" onClick={() => app.selectTask(c.id)}>
                    {c.title}
                  </button>
                  {showBacks && <span className="muted small card-back">{c.notes}</span>}
                  <span className={`card-state small ${r.known ? 'known' : r.wrong ? 'missed' : ''}`} title={r.right || r.wrong ? `✓ ${r.right ?? 0} · ✗ ${r.wrong ?? 0}` : 'Not studied yet'}>
                    {r.known ? '✓' : r.wrong ? '✗' : '–'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        {!cards.length && <p className="muted small">No cards yet. Add one above, or import a set.</p>}
      </div>
    </section>
  )
}

/** Add one card (front and back), or import many: paste text or choose a .yaml / .txt / .csv / .json file. */
function AddCards({ list, onError }: { list: List; onError: (e: unknown) => void }) {
  const app = useApp()
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [importing, setImporting] = useState(false)
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<Card[] | null>(null)

  const add = (c: Card) =>
    addTaskNow(list, { title: c.front.slice(0, 500), notes: c.back, priority: 2, status: 'todo', context: list.defaultContext, durationDays: 1, dependsOn: [] }, app.uid).written.catch(onError)

  function addOne(e: FormEvent) {
    e.preventDefault()
    if (!front.trim()) return
    void add({ front: front.trim(), back: back.trim() })
    setFront('')
    setBack('')
  }

  async function read(t: string) {
    setText(t)
    setPreview(t.trim() ? await parseCards(t) : null)
  }

  async function addAll() {
    if (!preview?.length) return
    // One at a time, so they keep their order.
    for (const c of preview) await add(c)
    setText('')
    setPreview(null)
    setImporting(false)
  }

  return (
    <div className="add-cards">
      <form className="add-card" onSubmit={addOne}>
        <input value={front} onChange={(e) => setFront(e.target.value)} placeholder="Front (the question)" aria-label="Card front" />
        <input value={back} onChange={(e) => setBack(e.target.value)} placeholder="Back (the answer)" aria-label="Card back" />
        <button type="submit" className="icon-button" aria-label="Add card" title="Add card" disabled={!front.trim()}>
          <Icon name="plus" />
        </button>
      </form>
      <button type="button" className="link small" onClick={() => setImporting(!importing)}>
        {importing ? 'Close import' : 'Import a set of cards…'}
      </button>
      {importing && (
        <div className="import-cards">
          <p className="muted small">
            Paste lines like <code>front | back</code> (or tab between them, or <code>Q:</code> / <code>A:</code> lines), or a YAML list of{' '}
            <code>front:</code> / <code>back:</code> (also <code>q:</code> / <code>a:</code>, <code>term:</code> / <code>definition:</code>). Or choose a file.
          </p>
          <textarea rows={6} value={text} onChange={(e) => void read(e.target.value)} placeholder={'Paris | Capital of France\n7 × 8 | 56'} aria-label="Cards to import" />
          <input
            type="file"
            accept=".yaml,.yml,.txt,.csv,.tsv,.json,text/plain"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) f.text().then(read).catch(onError)
              e.target.value = ''
            }}
            aria-label="Cards file"
          />
          {preview && (
            <p className="small">
              {preview.length ? `${preview.length} card${preview.length > 1 ? 's' : ''} found, e.g. “${preview[0].front}” → “${preview[0].back}”.` : 'No cards found in that text.'}{' '}
              {preview.length > 0 && (
                <button type="button" className="small" onClick={() => void addAll()}>
                  Add {preview.length}
                </button>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
