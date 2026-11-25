import { useState } from 'react'
import { sendToInbox } from '../../firebase/inbox'
import { useDailyBoards, type GameScore } from '../../firebase/games'
import { useApp } from '../../hooks/useApp'
import { dailyStandings, wordleDay } from '../../games/wordle'
import { Icon } from '../UI/Icon'

/** A board's rows as small colored squares (C / P / A). */
function MiniBoard({ rows }: { rows: string[] }) {
  return (
    <span className="wordle-mini" aria-hidden="true">
      {rows.map((row, i) => (
        <span key={i} className="wordle-mini-row">
          {[...row].map((c, j) => (
            <span key={j} className={`wordle-mini-cell ${c === 'C' ? 'correct' : c === 'P' ? 'present' : 'absent'}`} />
          ))}
        </span>
      ))}
    </span>
  )
}

const remindKey = (date: string, uid: string) => `align-wordle-reminded:${date}:${uid}`

/**
 * One day's Wordle for the whole family: who solved it (fewest guesses, then fastest), who missed or gave up, who's
 * playing now, and who hasn't played yet, with Remind (an Inbox message and notification, once per person per day).
 * Everyone's colored squares (no letters) show once you've finished it yourself.
 */
export function WordleDailyResults({ date, today, scores, finished }: { date: string; today: string; scores: GameScore[]; finished: boolean }) {
  const app = useApp()
  const boards = useDailyBoards(date)
  const [reminded, setReminded] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState<string | null>(null)
  const people = Object.entries(app.household.members)
    .filter(([, m]) => (m.role === 'member' || m.role === 'viewer') && !m.bot)
    .map(([uid, m]) => ({ uid, name: m.displayName }))
  const standings = dailyStandings(people, scores.map((s) => ({ uid: s.uid, guesses: s.best.guesses, ms: s.best.ms })), boards)
  const isToday = date === today
  const wasReminded = (uid: string) => reminded.has(uid) || !!localStorage.getItem(remindKey(date, uid))

  async function remind(uid: string) {
    setError(null)
    try {
      await sendToInbox(app.uid, [uid], {
        kind: 'game',
        title: `reminded you to play ${isToday ? 'today’s Wordle' : `the Wordle for ${wordleDay(date)}`}`,
        text: 'Everyone gets the same word that day, so your result ranks with the family’s.',
        link: `#/games/play/wordle/${date}`,
      })
      localStorage.setItem(remindKey(date, uid), '1')
      setReminded((r) => new Set(r).add(uid))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <article className="card game-leaderboard wordle-day-results">
      <h3>
        {isToday ? 'Today’s results' : 'Results'} · {wordleDay(date)}
      </h3>
      <p className="muted small">Fewest guesses, then fastest time{finished ? '' : ' · everyone’s squares show once you’ve finished'}</p>
      {error && <p className="error small">{error}</p>}
      <ol className="wordle-standings">
        {standings.map((s) => (
          <li key={s.uid} className={`wordle-standing ${s.state}${s.uid === app.uid ? ' game-score-me' : ''}`}>
            <span className="wordle-standing-place">{s.place ?? ''}</span>
            <strong className="wordle-standing-name">{s.uid === app.uid ? `${s.name} (you)` : s.name}</strong>
            <span className="wordle-standing-result">{s.text}</span>
            {(finished || s.uid === app.uid) && s.rows.length > 0 && s.state !== 'waiting' && <MiniBoard rows={s.rows} />}
            {s.state === 'waiting' && s.uid !== app.uid && (
              <button type="button" className="link small" disabled={wasReminded(s.uid)} onClick={() => void remind(s.uid)}>
                {wasReminded(s.uid) ? (
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
    </article>
  )
}
