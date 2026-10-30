import { useEffect, useState } from 'react'
import { playMove, saveLadder } from '../../firebase/rewards'
import { useApp } from '../../hooks/useApp'
import { useRewards } from '../../hooks/useRewards'
import { moveHits } from '../../utils/reveal'
import { cleanLadder, type Reward } from '../../utils/sparks'
import { people } from '../../utils/tasks'
import { HelpTip } from '../UI/HelpTip'
import { Icon } from '../UI/Icon'
import { IcePicture } from './IcePicture'
import { RevealBoard } from './RevealBoard'

/**
 * The reveal (#/reveal): the match-3 board laid on the family photo's ice, your moves (one per spark), Peek (hold
 * to fade the gems and look), who has helped, and the reward ladder the family's sparks unlock.
 */
export default function RevealView() {
  const app = useApp()
  const r = useRewards()
  // Ice this move has hit so far, shown at once (before it's saved), flashing and shattering as it goes.
  const [mine, setMine] = useState<Record<number, number>>({})
  const [breaking, setBreaking] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [peek, setPeek] = useState(false)
  const reveal = r.reveal
  const boardKey = reveal ? `${reveal.photoId}|${reveal.startedAt}` : ''
  useEffect(() => {
    if (!breaking.size) return
    const t = setTimeout(() => setBreaking(new Set()), 600)
    return () => clearTimeout(t)
  }, [breaking])

  if (!app.isMember) return <p className="muted">The reveal is for household members.</p>
  if (reveal === undefined) return <p className="muted">Opening…</p>
  const fail = (err: unknown) => setError(err instanceof Error ? err.message : String(err))
  const start = () => {
    setStarting(true)
    r.startNext()
      .catch(fail)
      .finally(() => setStarting(false))
  }

  const cells = reveal ? reveal.cols * reveal.rows : 0
  const left = r.left.map((n, i) => Math.max(0, n - (mine[i] ?? 0)))
  const clear = left.filter((n) => n === 0).length
  const pct = cells ? Math.round((clear / cells) * 100) : 0
  const done = !!reveal && cells > 0 && clear >= cells

  return (
    <section className="reveal-view">
      <header className="view-header">
        <h2>
          <Icon name="sparkle" /> Reveal
        </h2>
        <HelpTip topic="rewards" />
      </header>

      {!reveal ? (
        <div className="card">
          <p>Uncover a family photo together: each goal you meet is a move in a match game that breaks the ice over it.</p>
          <button type="button" onClick={start} disabled={starting}>
            {starting ? 'Picking a photo…' : 'Start a reveal'}
          </button>
        </div>
      ) : (
        <>
          <div className="reveal-stage">
            <div className="reveal-status row">
              <span className="grow">
                <strong>{done ? 'Uncovered!' : `${pct}% uncovered`}</strong>
                {!done && (
                  <span>
                    {' '}
                    · <strong>{r.moves}</strong> {r.moves === 1 ? 'move' : 'moves'} left
                  </span>
                )}
              </span>
              {!done && (
                <button
                  type="button"
                  className="secondary small reveal-peek"
                  onPointerDown={() => setPeek(true)}
                  onPointerUp={() => setPeek(false)}
                  onPointerLeave={() => setPeek(false)}
                  onPointerCancel={() => setPeek(false)}
                  onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && setPeek(true)}
                  onKeyUp={() => setPeek(false)}
                  onContextMenu={(e) => e.preventDefault()}
                  aria-pressed={peek}
                  title="Hold to see the picture without the gems"
                >
                  <Icon name="search" /> Peek
                </button>
              )}
            </div>
            {done && <IcePicture photoId={reveal.photoId} cols={reveal.cols} rows={reveal.rows} left={left} thick={reveal.thick} className="reveal-picture" />}
            {!done && (
              <>
                <RevealBoard
                  boardKey={boardKey}
                  photoId={reveal.photoId}
                  breaking={breaking}
                  peek={peek}
                  cols={reveal.cols}
                  rows={reveal.rows}
                  left={left}
                  thick={reveal.thick}
                  movesLeft={r.moves}
                  onHits={(cellsHit) => {
                    const iced = cellsHit.filter((i) => left[i] > 0)
                    if (!iced.length) return
                    setBreaking((b) => new Set([...b, ...iced]))
                    setMine((m) => {
                      const next = { ...m }
                      for (const i of iced) next[i] = (next[i] ?? 0) + 1
                      return next
                    })
                  }}
                  onMoveDone={(bursts) => {
                    // The saved hits: each burst on ice takes a layer, plus the end-game chip (it flashes too).
                    const hits = moveHits(bursts, r.left, reveal.cols)
                    const assisted = Object.keys(hits).map(Number).filter((i) => !bursts.includes(i))
                    if (assisted.length) setBreaking((b) => new Set([...b, ...assisted]))
                    const finished = r.left.every((n, i) => n - (hits[i] ?? 0) <= 0)
                    playMove(app.uid, hits, finished && !reveal.doneAt).catch(fail)
                    setMine({})
                  }}
                />
                <p className="muted small reveal-hint">
                  {r.moves > 0
                    ? 'Swipe a gem to line up 3 or more. Bursts break the frost under them, uncovering that bit of the photo for good.'
                    : 'Out of moves: each goal you meet is one more.'}
                </p>
              </>
            )}
            {done && (
              <button type="button" onClick={start} disabled={starting}>
                {starting ? 'Picking a photo…' : 'Start the next one'}
              </button>
            )}
          </div>
          <Helpers by={reveal.by ?? {}} />
        </>
      )}
      {error && <p className="error small">{error}</p>}
      <Ladder />
    </section>
  )
}

/** Who has broken how much ice so far, in everyone's color (no ranking: by household order). */
function Helpers({ by }: { by: Record<string, number> }) {
  const { household } = useApp()
  const who = people(household, true).filter(([uid]) => (by[uid] ?? 0) > 0)
  if (!who.length) return null
  return (
    <div className="day-section">
      <h3 className="small">Breaking the ice</h3>
      <div className="reveal-share">
        {who.map(([uid, m]) => (
          <span key={uid} style={{ flexGrow: by[uid], background: m.color }} title={`${m.displayName}: ${by[uid]}`} />
        ))}
      </div>
      <p className="small muted">{who.map(([uid, m]) => `${m.displayName} ${by[uid]}`).join(' · ')}</p>
    </div>
  )
}

/** The reward ladder: unlocked by the family's lifetime sparks (never spent). Members edit it. */
function Ladder() {
  const app = useApp()
  const r = useRewards()
  const [editing, setEditing] = useState<{ title: string; sparks: string }[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const save = () => {
    if (!editing) return
    saveLadder(app.uid, cleanLadder(editing))
      .then(() => setEditing(null))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }
  return (
    <div className="day-section reward-ladder">
      <h3 className="row">
        <span className="grow">Rewards</span>
        <span className="muted small">{r.total} family sparks</span>
        {!editing && (
          <button type="button" className="link small" onClick={() => setEditing(r.ladder.map((x: Reward) => ({ title: x.title, sparks: String(x.sparks) })))}>
            Edit
          </button>
        )}
      </h3>
      {editing ? (
        <div className="ladder-edit">
          {editing.map((x, i) => (
            <div key={i} className="row">
              <input className="grow" value={x.title} onChange={(e) => setEditing(editing.map((y, k) => (k === i ? { ...y, title: e.target.value } : y)))} placeholder="A reward" aria-label="Reward" maxLength={60} />
              <input className="ladder-sparks" value={x.sparks} onChange={(e) => setEditing(editing.map((y, k) => (k === i ? { ...y, sparks: e.target.value } : y)))} inputMode="numeric" aria-label="Sparks to unlock it" />
              <button type="button" className="link small" onClick={() => setEditing(editing.filter((_, k) => k !== i))} aria-label={`Remove ${x.title || 'this reward'}`}>
                <Icon name="close" />
              </button>
            </div>
          ))}
          <div className="row">
            {editing.length < 20 && (
              <button type="button" className="link small" onClick={() => setEditing([...editing, { title: '', sparks: '' }])}>
                <Icon name="plus" /> Add a reward
              </button>
            )}
            <span className="grow" />
            <button type="button" className="secondary small" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="button" className="small" onClick={save}>
              Save
            </button>
          </div>
          {error && <p className="error small">{error}</p>}
        </div>
      ) : (
        <ol className="ladder">
          {r.status.rewards.map((x) => (
            <li key={`${x.title}${x.sparks}`} className={x.unlocked ? 'unlocked' : ''}>
              <span className="ladder-mark">{x.unlocked ? '✓' : ''}</span>
              <span className="grow">{x.title}</span>
              <span className="muted small">{x.unlocked ? 'Unlocked' : `${x.sparks - r.total} to go`}</span>
              <span className="ladder-bar" aria-hidden="true">
                <span style={{ width: `${Math.min(100, (r.total / x.sparks) * 100)}%` }} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
