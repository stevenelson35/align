import { useState, type FormEvent } from 'react'
import { formatDay, today } from '../../engine/dates'
import { addTaskNow, ratePick, setWatched } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import { useStoredSet } from '../../hooks/useStoredSet'
import type { List, Task } from '../../types'
import { averageRating, lastDone, pickKind, pickOne, rankPicks, REST_DAYS, type Ranked } from '../../utils/picks'
import { people, targetName } from '../../utils/tasks'
import { ListHeader } from '../Tasks/ListHeader'
import { DetailsMarks } from '../UI/Details'
import { Icon } from '../UI/Icon'
import { SectionHeader } from '../UI/SectionHeader'
import { StarRating } from './StarRating'

type Sort = 'tonight' | 'rating' | 'newest' | 'title'

/**
 * A pick list (DESIGN.md §5.8): titles everyone rates 1–5, and Tonight, which ranks them for whoever is there and
 * can pick one. Watched ones sit out for a month. Tap a title for its note, links, pictures and comments.
 */
export function PicksView({ list }: { list: List }) {
  const app = useApp()
  const { listItems } = useData()
  const kind = pickKind(list.pickKind)
  const now = today()
  const editable = app.canEdit(list)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('tonight')
  const [picked, setPicked] = useState<string | null>(null)
  // Who's there tonight, remembered per list on this device; you're in it until you untick yourself.
  const [away, toggleAway] = useStoredSet(`align-picks-away:${list.id}`)
  const household = people(app.household, true)
  const watching = household.map(([id]) => id).filter((id) => !away.has(id))

  const items = listItems.filter((t) => t.listId === list.id)
  const ranked = rankPicks(items, watching, now)
  const top = ranked.slice(0, 3)
  const chosen = picked ? ranked.find((r) => r.item.id === picked) : undefined
  const fail = (err: unknown) => setError(err instanceof Error ? err.message : String(err))

  function add(e: FormEvent) {
    e.preventDefault()
    const text = title.trim()
    if (!text) return
    setError(null)
    setTitle('')
    addTaskNow(list, { title: text, priority: 2, status: 'todo', context: list.defaultContext, durationDays: 1, dependsOn: [] }, app.uid).written.catch((err) => {
      fail(err)
      setTitle(text)
    })
  }

  const rankOf = new Map(ranked.map((r, i) => [r.item.id, i]))
  const sorted = [...items].sort((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title)
    if (sort === 'newest') return (b.createdAt?.seconds ?? Infinity) - (a.createdAt?.seconds ?? Infinity)
    if (sort === 'rating') return (averageRating(b) ?? 0) - (averageRating(a) ?? 0) || a.title.localeCompare(b.title)
    return (rankOf.get(a.id) ?? 1e9) - (rankOf.get(b.id) ?? 1e9) || a.title.localeCompare(b.title)
  })

  const watchedLine = (t: Task) => {
    const last = lastDone(t)
    return last ? `${kind.did} ${formatDay(last).replace(/^\w+, /, '')}` : ''
  }
  const whoRated = (r: Ranked) =>
    [...r.ratings.map((x) => `${x.uid === app.uid ? 'You' : targetName(x.uid, app.household)} ${x.stars}`), ...r.unrated.map((u) => `${u === app.uid ? 'You' : targetName(u, app.household)} ?`)].join(' · ')

  return (
    <section className="picks-view">
      <ListHeader list={list} />

      <div className="day-section picks-tonight">
        <SectionHeader icon="star" title="Tonight" help="picks" />
        <div className="also-show small" role="group" aria-label="Who's here">
          <span className="muted">Who’s here:</span>
          {household.map(([id, m]) => (
            <label key={id} className={`chip-toggle${away.has(id) ? '' : ' on'}`}>
              <input type="checkbox" checked={!away.has(id)} onChange={() => toggleAway(id)} />
              {id === app.uid ? 'You' : m.displayName}
            </label>
          ))}
        </div>
        {!watching.length && <p className="muted small">Tick who’s here.</p>}
        {watching.length > 0 && !top.length && <p className="muted small">{items.length ? `Everything was ${kind.did.toLowerCase()} in the last ${REST_DAYS} days.` : 'Add some titles below, then rate them.'}</p>}
        {top.length > 0 && (
          <ol className="picks-top">
            {top.map((r) => (
              <li key={r.item.id} className={r.item.id === picked ? 'chosen' : ''}>
                <button type="button" className="link pick-title" onClick={() => app.selectTask(r.item.id)}>
                  {r.item.title}
                </button>
                <span className="muted small"> {whoRated(r)}</span>
              </li>
            ))}
          </ol>
        )}
        {top.length > 0 && (
          <div className="row wrap">
            <button type="button" className="secondary small" onClick={() => setPicked(pickOne(ranked)?.item.id ?? null)}>
              <Icon name="star" /> {picked ? 'Pick again' : 'Pick for us'}
            </button>
            {chosen && (
              <>
                <strong className="picked-title">{chosen.item.title}</strong>
                <button
                  type="button"
                  className="small"
                  onClick={() => {
                    setWatched(chosen.item.id, now, true).catch(fail)
                    setPicked(null)
                  }}
                >
                  ✓ {kind.did} tonight
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="day-section">
        <SectionHeader icon="list" title={kind.label} count={items.length}>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by">
            <option value="tonight">Tonight</option>
            <option value="rating">Rating</option>
            <option value="newest">Newest</option>
            <option value="title">A–Z</option>
          </select>
        </SectionHeader>
        {editable && (
          <form className="row add-task" onSubmit={add}>
            <input placeholder={`Add a title to ${kind.doing}…`} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="New title" />
            <button type="submit" className="icon-button" aria-label="Add" title="Add">
              <Icon name="plus" />
            </button>
          </form>
        )}
        {error && <p className="error small">{error}</p>}
        <ul className="picks-list">
          {sorted.map((t) => {
            const avg = averageRating(t)
            const count = Object.keys(t.ratings ?? {}).length
            const last = lastDone(t)
            const resting = last !== undefined && rankOf.get(t.id) === undefined && watching.length > 0
            return (
              <li key={t.id} className={`pick-row${app.selectedTaskId === t.id ? ' selected' : ''}${resting ? ' resting' : ''}`}>
                <div className="grow">
                  <button type="button" className="link pick-title" onClick={() => app.selectTask(t.id)}>
                    {t.title}
                  </button>
                  <DetailsMarks links={t.links} images={t.images} />
                  <div className="muted small">
                    {avg !== undefined ? `★ ${avg} (${count})` : 'Not rated yet'}
                    {last && ` · ${watchedLine(t)}`}
                    {resting && ' · resting'}
                  </div>
                </div>
                {app.isMember ? (
                  <StarRating value={t.ratings?.[app.uid]} onChange={(stars) => ratePick(t.id, app.uid, stars).catch(fail)} label={`Your rating for ${t.title}`} />
                ) : (
                  <StarRating value={avg !== undefined ? Math.round(avg) : undefined} label={`${t.title}, average`} />
                )}
              </li>
            )
          })}
        </ul>
        {!items.length && <p className="muted small">Nothing here yet.</p>}
      </div>
    </section>
  )
}
