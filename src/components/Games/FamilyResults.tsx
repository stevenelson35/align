import { useState } from 'react'
import { sendToInbox } from '../../firebase/inbox'
import { useApp } from '../../hooks/useApp'
import { useStoredSet } from '../../hooks/useStoredSet'
import { Icon } from '../UI/Icon'

/**
 * Today's family results for a daily game, the same shape for every one (Wordle's adds the colored squares): who has
 * played, ranked ("1 Linda 1:46"), then "N haven't played yet", folded, with Remind (once per person per day on this
 * device). The card folds too; both are remembered on this device.
 */
export function FamilyResults({ gameId, gameName, day, rows }: { gameId: string; gameName: string; day: string; /** Who has played, best first, with their result ("12 moves · 0:45"). */ rows: { uid: string; text: string }[] }) {
  const app = useApp()
  const [opened, toggle] = useStoredSet('align-wordle-results-open')
  const [reminded, setReminded] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState<string | null>(null)
  const closed = opened.has('results-closed')
  const waitingOpen = opened.has('waiting')
  const people = Object.entries(app.household.members).filter(([, m]) => (m.role === 'member' || m.role === 'viewer') && !m.bot)
  const playedIds = new Set(rows.map((r) => r.uid))
  const waiting = people.filter(([id]) => !playedIds.has(id)).sort((a, b) => a[1].displayName.localeCompare(b[1].displayName))
  const name = (uid: string) => (uid === app.uid ? `${app.household.members[uid]?.displayName ?? 'You'} (you)` : (app.household.members[uid]?.displayName ?? 'Family member'))
  const key = (uid: string) => `align-remind:${gameId}:${day}:${uid}`
  const wasReminded = (uid: string) => reminded.has(uid) || !!localStorage.getItem(key(uid))

  async function remind(uid: string) {
    setError(null)
    try {
      await sendToInbox(app.uid, [uid], { kind: 'game', title: `reminded you to play today’s ${gameName}`, text: 'Everyone gets the same puzzle today, so your time ranks with the family’s.', link: `#/games/daily/${gameId}` })
      localStorage.setItem(key(uid), '1')
      setReminded((r) => new Set(r).add(uid))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <article className="card game-leaderboard wordle-day-results">
      <button type="button" className="wordle-results-head" onClick={() => toggle('results-closed')} aria-expanded={!closed}>
        <h3>Today’s Results</h3>
        <span className="muted small">
          {rows.length} of {people.length} played
        </span>
        <span className="grow" />
        <Icon name={closed ? 'chevron-right' : 'chevron-down'} />
      </button>
      {!closed && (
        <>
          {error && <p className="error small">{error}</p>}
          {rows.length ? (
            <ol className="wordle-standings">
              {rows.map((r, i) => (
                <li key={r.uid} className={`wordle-standing solved${r.uid === app.uid ? ' game-score-me' : ''}`}>
                  <span className="wordle-standing-place">{i + 1}</span>
                  <strong className="wordle-standing-name">{name(r.uid)}</strong>
                  <span className="wordle-standing-result">{r.text}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted small">Nobody has played yet.</p>
          )}
          {waiting.length > 0 && (
            <>
              <button type="button" className="link small wordle-waiting-toggle" onClick={() => toggle('waiting')} aria-expanded={waitingOpen}>
                <Icon name={waitingOpen ? 'chevron-down' : 'chevron-right'} /> {waiting.length} {waiting.length === 1 ? 'hasn’t' : 'haven’t'} played yet
                {waitingOpen ? '' : ' · remind them'}
              </button>
              {waitingOpen && (
                <ol className="wordle-standings">
                  {waiting.map(([id]) => (
                    <li key={id} className={`wordle-standing waiting${id === app.uid ? ' game-score-me' : ''}`}>
                      <span className="wordle-standing-place" />
                      <strong className="wordle-standing-name">{name(id)}</strong>
                      <span className="wordle-standing-result">Not played yet</span>
                      {id !== app.uid && (
                        <button type="button" className="link small" disabled={wasReminded(id)} onClick={() => void remind(id)}>
                          {wasReminded(id) ? (
                            <>
                              <Icon name="check" /> Reminded
                            </>
                          ) : (
                            'Remind'
                          )}
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </>
      )}
    </article>
  )
}
