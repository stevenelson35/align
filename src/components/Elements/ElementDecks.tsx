import { useState } from 'react'
import { addTaskNow, createList } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { List } from '../../types'
import { parentsOf, privacyFields } from '../../utils/audience'
import { SCOPES, SERIES, seriesCards } from '../../utils/elementCards'
import type { Element } from '../../utils/elements'
import { Icon } from '../UI/Icon'

/**
 * "Learn them with flashcards": makes the five element sets (symbols, families, atomic numbers, family traits, which
 * is which) for the elements you choose, as flashcard lists the whole family can study and compete on. Running it
 * again adds only the cards a set is missing (say, after choosing Everyday elements too).
 */
export function ElementDecks({ elements }: { elements: Element[] }) {
  const app = useApp()
  const { lists, listItems } = useData()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sets = SERIES.map((s) => ({ ...s, list: lists.find((l) => l.kind === 'cards' && l.name === s.name) }))
  // Which groups of elements the sets already hold in full (every set has every one of their cards).
  const inSets = new Set<string>(
    SCOPES.filter((scope) => {
      const chosen = elements.filter((e) => scope.symbols.includes(e.symbol))
      return sets.every((s) => {
        if (!s.list) return false
        const have = new Set(listItems.filter((t) => t.listId === s.list!.id).map((t) => `${t.title}|${t.notes ?? ''}`))
        return seriesCards(s.id, chosen).every((c) => have.has(`${c.front}|${c.back}`))
      })
    }).map((s) => s.id),
  )
  // What to add: what you tick, starting with the first group that isn't in the sets yet.
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const scopes = picked ?? new Set(SCOPES.filter((s) => !inSets.has(s.id)).slice(0, 1).map((s) => s.id))
  const setScopes = setPicked
  const allIn = SCOPES.every((s) => inSets.has(s.id))
  if (!app.isMember) return null

  async function make() {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const symbols = SCOPES.filter((s) => scopes.has(s.id)).flatMap((s) => s.symbols)
      const chosen = elements.filter((e) => symbols.includes(e.symbol))
      let made = 0
      // The sets first (each needs its id), then every card at once: the writes go out together, in order, so "In
      // order" keeps the table's order, without waiting for each card in turn.
      const targets: List[] = []
      for (const s of sets) {
        if (s.list) {
          targets.push(s.list)
          continue
        }
        const fields = { name: s.name, kind: 'cards' as const, ownerId: app.uid, defaultContext: 'family' as const, ...privacyFields('everyone', app.uid, [], parentsOf(app.household)) }
        const id = await createList(fields)
        targets.push({ id, ...fields } as List)
        made++
      }
      const writes: Promise<void>[] = []
      sets.forEach((s, i) => {
        const list = targets[i]
        if (s.list && !app.canEdit(list)) return
        const have = new Set(listItems.filter((t) => t.listId === list.id).map((t) => `${t.title}|${t.notes ?? ''}`))
        for (const c of seriesCards(s.id, chosen)) {
          if (have.has(`${c.front}|${c.back}`)) continue
          writes.push(addTaskNow(list, { title: c.front, notes: c.back, priority: 2, status: 'todo', context: 'family', durationDays: 1, dependsOn: [] }, app.uid).written)
        }
      })
      const added = writes.length
      let saved = 0
      setNote(`Saving ${added} cards…`)
      await Promise.all(writes.map((w) => w.then(() => setNote(`Saving ${added} cards… ${++saved} done`))))
      setPicked(null) // the next choice follows what the sets now hold
      setNote(made ? `Made ${made} set${made > 1 ? 's' : ''} with ${added} cards. Study them under Flashcards.` : added ? `Added ${added} cards to your sets.` : 'Your sets already have these cards.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    setBusy(false)
  }

  return (
    <section className="element-decks">
      <h3>
        <Icon name="book" /> Learn them with flashcards
      </h3>
      <p className="muted small">
        Five sets, each a different way to remember: the symbol, the family, the atomic number, what a family has in common, and which element belongs to a family. Every answer shows the
        element in the table and its family. Review them by flipping, or play Challenge for the leaderboard.
      </p>
      {SCOPES.map((s) =>
        inSets.has(s.id) ? (
          <p key={s.id} className="small element-scope-done">
            <Icon name="check" /> {s.label} <span className="muted">({s.symbols.length}): in your sets</span>
          </p>
        ) : (
        <label key={s.id} className="inline small">
          <input
            type="checkbox"
            checked={scopes.has(s.id)}
            onChange={() => {
              const next = new Set(scopes)
              if (next.has(s.id)) next.delete(s.id)
              else next.add(s.id)
              setScopes(next)
            }}
          />{' '}
          {s.label} <span className="muted">({s.symbols.length})</span>
        </label>
        ),
      )}
      {allIn ? (
        <p className="muted small">All of these are in your sets: study them below.</p>
      ) : (
        <div className="row wrap">
          <button type="button" className="small" onClick={make} disabled={busy || ![...scopes].some((id) => !inSets.has(id))}>
            <Icon name="plus" /> {sets.some((s) => s.list) ? 'Add these to the sets' : 'Make the flashcard sets'}
          </button>
        </div>
      )}
      {note && <p className="small sent-note"><Icon name="check" /> {note}</p>}
      {error && <p className="error small">{error}</p>}
      {sets.some((s) => s.list) && (
        <ul className="element-deck-links">
          {sets.map((s) =>
            s.list ? (
              <li key={s.id}>
                <button type="button" className="link" onClick={() => app.navigate({ view: 'list', listId: s.list!.id, timeline: false })}>
                  {s.name}
                </button>{' '}
                <span className="muted small">{s.about}</span>
              </li>
            ) : null,
          )}
        </ul>
      )}
    </section>
  )
}
