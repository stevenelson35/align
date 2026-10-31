import { useMemo, useState, type FormEvent } from 'react'
import { addTaskNow, recordCard, resetCards } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { List, Task } from '../../types'
import { choicesFor, parseCards, resultFor, STUDY_MODES, studyOrder, type Card, type StudyMode } from '../../utils/flashcards'
import { ListHeader } from '../Tasks/ListHeader'
import { Icon } from '../UI/Icon'
import { RevealCard } from '../UI/RevealCard'
import { SectionHeader } from '../UI/SectionHeader'
import { celebrate } from '../../utils/celebrate'
import { useGeoIndex } from '../../hooks/useGeo'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { matchCard, nearbyAnswers, setPrefers, type Place } from '../../utils/geo'
import { LearnMore } from './LearnMore'
import { Neighbors, PlaceMap } from './PlaceMap'

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
  const [run, setRun] = useState(0)
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
  // Geography cards (a country or US state on either side) get maps: a hint on the front, a labeled map on the back.
  const geo = useGeoIndex(cards.length > 0)
  const cardKey = cards.map((c) => `${c.id}:${c.title}:${c.notes ?? ''}`).join('|')
  const places = useMemo(() => {
    const out = new Map<string, Place>()
    if (!geo) return out
    const prefer = setPrefers(cards.map((c) => ({ front: c.title, back: c.notes ?? '' })), geo)
    for (const c of cards) {
      const p = matchCard(c.title, c.notes ?? '', geo, prefer)
      if (p) out.set(c.id, p)
    }
    return out
    // cardKey stands for the cards' words
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, cardKey])
  const [hintOpen, setHintOpen] = useState(false)
  const [mapFirst, setMapFirst] = useStoredFlag(`align-cards-map-first-${list.id}`, false)
  const canMapFirst = places.size >= 3
  // Multiple choice: always (per set, on this device), or on a card you're stuck on (Choices).
  const [choicesAlways, setChoicesAlways] = useStoredFlag(`align-cards-choices-${list.id}`, false)
  const [choicesOpen, setChoicesOpen] = useState(false)
  const [picked, setPicked] = useState<{ choice: string; right: boolean } | null>(null)

  function start(m: StudyMode) {
    const order = studyOrder(cards, m, app.uid, crypto.getRandomValues(new Uint32Array(1))[0])
    if (!order.length) return setError(m === 'unknown' ? 'You’ve got them all. Try Shuffled, or Start over.' : 'Add some cards first.')
    setError(null)
    setRevealed(false)
    setRun(0)
    setChoicesOpen(false)
    setPicked(null)
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
    setChoicesOpen(false)
    setPicked(null)
    // Right answers in a row make the sparkle a little bigger; a miss just starts the count again, quietly.
    setRun(gotIt ? run + 1 : 0)
    const next = { ...session, at: session.at + 1, right: session.right + (gotIt ? 1 : 0), wrong: session.wrong + (gotIt ? 0 : 1) }
    setSession(next)
    // Every card right (3 or more): the big burst.
    if (next.at >= next.ids.length && next.wrong === 0 && next.right >= 3) setTimeout(() => celebrate({ done: next.right, total: next.right, message: `All ${next.right} right!` }), 450)
  }

  const current = session && session.at < session.ids.length ? cards.find((c) => c.id === session.ids[session.at]) : undefined
  const finished = session && session.at >= session.ids.length
  const currentPlace = current && geo ? places.get(current.id) : undefined
  const mapFirstHere = mapFirst && canMapFirst && !!currentPlace
  // In Map first the answer is the front's words (the place); otherwise the back.
  const answerText = current ? (mapFirstHere ? current.title : (current.notes ?? '')).trim() : ''
  const choices = useMemo(() => {
    if (!current || !answerText) return []
    const pool = cards.filter((c) => c.id !== current.id).map((c) => (mapFirstHere ? c.title : (c.notes ?? '')))
    return choicesFor(answerText, pool, currentPlace && geo ? nearbyAnswers(currentPlace, geo.meta, answerText) : [], Math.random)
    // A new card (or a new turn of the same one) deals new choices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, session?.at, mapFirstHere, answerText])
  const showChoices = choices.length > 1 && (choicesAlways || choicesOpen)
  function pick(choice: string, at: DOMRect) {
    if (picked || !current) return
    const right = choice.toLowerCase() === answerText.toLowerCase()
    setPicked({ choice, right })
    if (right) celebrate({ done: 0, total: 0, x: at.left + at.width / 2, y: at.top + at.height / 2, small: { run: run + 1 } })
    setTimeout(() => setRevealed(true), right ? 450 : 900)
  }

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
            {cards.length >= 2 && (
              <label className="inline small" title="Every card offers four answers to pick from">
                <input type="checkbox" checked={choicesAlways} onChange={(e) => setChoicesAlways(e.target.checked)} /> Multiple choice
              </label>
            )}
            {canMapFirst && (
              <label className="inline small" title="Each card starts as a map with the place filled in: name it, then check">
                <input type="checkbox" checked={mapFirst} onChange={(e) => setMapFirst(e.target.checked)} /> Map first
              </label>
            )}
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
              front={
                <FlashFront
                  title={current.title}
                  place={geo ? places.get(current.id) : undefined}
                  geo={geo}
                  mapFirst={mapFirst && canMapFirst}
                  hintOpen={hintOpen}
                  onHint={() => setHintOpen(!hintOpen)}
                  choices={showChoices ? choices : undefined}
                  canChoose={!revealed && !showChoices && choices.length > 1}
                  onChoices={() => setChoicesOpen(true)}
                  answer={answerText}
                  picked={picked}
                  onPick={pick}
                />
              }
              back={<FlashBack title={current.title} notes={current.notes} place={geo ? places.get(current.id) : undefined} geo={geo} mapFirst={mapFirst && canMapFirst} />}
              open={revealed}
              onOpen={() => setRevealed(true)}
              tapAnywhere
              revealLabel="Tap to show the answer"
              footer={
                revealed &&
                (picked ? (
                  <div className="row flash-answer">
                    <span className={picked.right ? 'flash-right' : 'flash-wrong'}>{picked.right ? '✓ Right!' : 'Not quite'}</span>
                    <button type="button" className="small" onClick={() => answer(current, picked.right)}>
                      Next
                    </button>
                  </div>
                ) : (
                  <div className="row flash-answer">
                    <button
                      type="button"
                      className="small"
                      onClick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect()
                        celebrate({ done: 0, total: 0, x: r.left + r.width / 2, y: r.top + r.height / 2, small: { run: run + 1 } })
                        answer(current, true)
                      }}
                    >
                      <Icon name="check" /> Got it
                    </button>
                    <button type="button" className="secondary small" onClick={() => answer(current, false)}>
                      <Icon name="close" /> Not yet
                    </button>
                  </div>
                ))
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

/** The four answers to pick from; after a pick, the right one goes green (and a wrong pick red). */
function Choices({ choices, answer, picked, onPick }: { choices: string[]; answer: string; picked: { choice: string; right: boolean } | null; onPick: (choice: string, at: DOMRect) => void }) {
  return (
    <div className="flash-choices" role="group" aria-label="Pick the answer">
      {choices.map((c) => {
        const state = picked ? (c.toLowerCase() === answer.toLowerCase() ? ' right' : c === picked.choice ? ' wrong' : ' faded') : ''
        return (
          <button key={c} type="button" className={`secondary flash-choice${state}`} disabled={!!picked} onClick={(e) => onPick(c, e.currentTarget.getBoundingClientRect())}>
            {c}
          </button>
        )
      })}
    </div>
  )
}

/**
 * A card's front: its words, and the help you can ask for: "Show map" for a place (the region with the place filled
 * in, no names) and "Choices" (four answers to pick from) when you're stuck, or always if the set is set to multiple
 * choice. In Map first, the map stands in for the words. The help sits above the card's tap-to-turn area.
 */
function FlashFront({
  title,
  place,
  geo,
  mapFirst,
  hintOpen,
  onHint,
  choices,
  canChoose,
  onChoices,
  answer,
  picked,
  onPick,
}: {
  title: string
  place?: Place
  geo: ReturnType<typeof useGeoIndex>
  mapFirst: boolean
  hintOpen: boolean
  onHint: () => void
  choices?: string[]
  canChoose: boolean
  onChoices: () => void
  answer: string
  picked: { choice: string; right: boolean } | null
  onPick: (choice: string, at: DOMRect) => void
}) {
  const help = (
    <>
      {(canChoose || (place && geo && !mapFirst)) && (
        <span className="row flash-help">
          {place && geo && !mapFirst && (
            <button type="button" className="link small" onClick={onHint} aria-expanded={hintOpen}>
              <Icon name="map" /> {hintOpen ? 'Hide map' : 'Show map'}
            </button>
          )}
          {canChoose && (
            <button type="button" className="link small" onClick={onChoices}>
              <Icon name="list" /> Choices
            </button>
          )}
        </span>
      )}
      {place && geo && !mapFirst && hintOpen && <PlaceMap place={place} mode="hint" index={geo} />}
      {choices && <Choices choices={choices} answer={answer} picked={picked} onPick={onPick} />}
    </>
  )
  if (place && geo && mapFirst)
    return (
      <div className="flash-extra">
        <span className="flash-ask">Where is this?</span>
        <PlaceMap place={place} mode="hint" index={geo} />
        {help}
      </div>
    )
  return (
    <>
      <span className="flash-front">{title}</span>
      <div className="flash-extra">{help}</div>
    </>
  )
}

/** A card's back: the answer, and for a place a labeled map (capital marked, neighbors named), its borders, and
 *  Learn more. In Map first the front's words show too, since the front was only a map. */
function FlashBack({ title, notes, place, geo, mapFirst }: { title: string; notes?: string; place?: Place; geo: ReturnType<typeof useGeoIndex>; mapFirst: boolean }) {
  return (
    <div className="flash-back-wrap">
      {mapFirst && place && <span className="flash-front">{title}</span>}
      <span className="flash-back">{notes || '(no answer written)'}</span>
      {place && geo && (
        <div className="flash-map">
          <PlaceMap place={place} mode="answer" index={geo} />
          <Neighbors place={place} index={geo} />
          <LearnMore place={place} index={geo} />
        </div>
      )}
    </div>
  )
}
