import { useCallback, useEffect, useRef, useState } from 'react'
import { today } from '../../engine/dates'
import { completeGameChallenge, inviteToGame, recordGameScore, useGameScores, type GameChallenge } from '../../firebase/games'
import { useApp } from '../../hooks/useApp'
import { celebrate } from '../../utils/celebrate'
import { compareGameResults, formatGameResult } from '../../games/catalog'
import { HANOI_DISKS, HANOI_DISK_OPTIONS, HANOI_RODS, hanoiOptimalMoves, hanoiSolved, isHanoiDiskCount, moveHanoiDisk, newHanoiBoard, type HanoiBoard, type HanoiRod } from '../../games/towerOfHanoi'
import { Icon } from '../UI/Icon'

const seconds = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

export function TowerOfHanoiGame({ challenge, onBack, onSolved }: { challenge?: GameChallenge; onBack: () => void; onSolved: () => void }) {
  const app = useApp()
  const challengeDisks = isHanoiDiskCount(challenge?.payload?.diskCount) ? challenge.payload.diskCount : HANOI_DISKS
  const [disks, setDisks] = useState(challengeDisks)
  const seed = challenge?.payload?.puzzleId ?? challenge?.seed ?? (disks === HANOI_DISKS ? today() : `hanoi-${disks}-${today()}`)
  const { scores, error: scoreError } = useGameScores('tower-of-hanoi', seed, app.isMember)
  const [board, setBoard] = useState<HanoiBoard>(() => newHanoiBoard(challengeDisks))
  const [source, setSource] = useState<HanoiRod | null>(null)
  const [moves, setMoves] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [solved, setSolved] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [inviting, setInviting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const startedAt = useRef(0)
  const people = Object.entries(app.household.members)
    .filter(([id, member]) => id !== app.uid && member.role === 'member' && !member.bot)
    .sort((a, b) => a[1].displayName.localeCompare(b[1].displayName))

  useEffect(() => { startedAt.current = Date.now() }, [disks])

  useEffect(() => {
    if (solved) return
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt.current), 250)
    return () => window.clearInterval(timer)
  }, [disks, solved])

  const saveResult = useCallback(async (resultMoves: number, resultMs: number) => {
    if (saving || saved) return
    setSaving(true)
    setError(null)
    const result = { moves: resultMoves, ms: resultMs }
    try {
      const personalBest = await recordGameScore(app.uid, 'tower-of-hanoi', seed, result)
      if (challenge) await completeGameChallenge(challenge.id, result)
      setSaved(true)
      if (personalBest) {
        const familyBest = !scores.length || compareGameResults('tower-of-hanoi', result, scores[0].best) < 0
        celebrate({ done: 1, total: 1, message: familyBest ? 'New family high score!' : 'New personal best!' })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [app.uid, challenge, saved, saving, scores, seed])

  const chooseRod = useCallback((rod: HanoiRod) => {
    if (solved) return
    if (!source) {
      if (!board[rod].length) {
        setMessage('Choose a rod with a disk on it.')
        return
      }
      setSource(rod)
      setMessage(`Choose where to move the top disk from rod ${rod}.`)
      return
    }
    if (source === rod) {
      setSource(null)
      setMessage('Move canceled.')
      return
    }
    const next = moveHanoiDisk(board, source, rod)
    setSource(null)
    if (!next) {
      setMessage('A larger disk cannot go on top of a smaller disk.')
      return
    }
    const count = moves + 1
    setBoard(next)
    setMoves(count)
    setMessage(null)
    if (hanoiSolved(next, disks)) {
      const time = Math.max(1, Date.now() - startedAt.current)
      setElapsed(time)
      setSolved(true)
      onSolved()
      void saveResult(count, time)
    }
  }, [board, disks, moves, onSolved, saveResult, solved, source])

  function chooseDiskCount(value: number) {
    if (challenge || !isHanoiDiskCount(value)) return
    setDisks(value)
    setBoard(newHanoiBoard(value))
    setSource(null)
    setMoves(0)
    setElapsed(0)
    setSolved(false)
    setSaved(false)
    setMessage(null)
    setError(null)
  }

  function reset() {
    if (challenge && solved) {
      onBack()
      return
    }
    setBoard(newHanoiBoard(disks))
    setSource(null)
    setMoves(0)
    setElapsed(0)
    setSolved(false)
    setSaved(false)
    setMessage(null)
    setError(null)
    startedAt.current = Date.now()
  }

  async function sendInvites() {
    setInviting(true)
    setError(null)
    setMessage(null)
    try {
      await inviteToGame(app.uid, selected, 'tower-of-hanoi', { puzzleId: seed, diskCount: disks, version: 1 })
      setMessage(`Challenge sent to ${selected.length} ${selected.length === 1 ? 'person' : 'people'}.`)
      setSelected([])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setInviting(false)
    }
  }

  return (
    <section className="games-view">
      <header className="view-header">
        <h2><Icon name="sparkle" /> Tower of Hanoi</h2>
        <span className="muted small">{challenge ? `Challenge from ${app.household.members[challenge.from]?.displayName ?? 'a family member'}` : 'Move the whole tower to the right rod.'}</span>
        <button type="button" className="secondary small" onClick={onBack}>Show All Games</button>
      </header>
      <article className="game-card card hanoi-game">
        <p className="muted small">Move one disk at a time. A larger disk may never sit on a smaller one.</p>
        {!challenge ? (
          <label className="inline small">
            Number of disks
            <select value={disks} onChange={(event) => chooseDiskCount(Number(event.target.value))}>
              {HANOI_DISK_OPTIONS.map((count) => (
                <option key={count} value={count}>{count} disks · {hanoiOptimalMoves(count)} minimum moves</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="muted small">{disks} disks · {hanoiOptimalMoves(disks)} minimum moves</p>
        )}
        <div className="game-status row" aria-live="polite">
          <strong>{moves} {moves === 1 ? 'move' : 'moves'}</strong>
          <span className="muted">·</span>
          <strong>{seconds(elapsed)}</strong>
          {solved && <span className="badge">Solved!</span>}
        </div>
        <div className="hanoi-rods" role="group" aria-label="Tower of Hanoi rods">
          {HANOI_RODS.map((rod) => (
            <button
              type="button"
              key={rod}
              className={`hanoi-rod${source === rod ? ' selected' : ''}`}
              onClick={() => chooseRod(rod)}
              aria-label={`Rod ${rod}${source === rod ? ', selected source' : ''}`}
              aria-pressed={source === rod}
            >
              <span className="hanoi-stack">
                {board[rod].map((disk) => (
                  <span key={disk} className={`hanoi-disk hanoi-disk-${disk}`} style={{ width: `${40 + disk * 9}%` }} aria-hidden="true" />
                ))}
                {Array.from({ length: disks - board[rod].length }, (_, i) => <span key={`space-${i}`} className="hanoi-space" aria-hidden="true" />)}
              </span>
              <strong>Rod {rod}</strong>
            </button>
          ))}
        </div>
        <p className="muted small" role="status">{solved ? saved ? 'Result saved to the family leaderboard.' : saving ? 'Saving your result…' : 'Puzzle solved.' : message ?? (source ? `Source: rod ${source}. Choose a destination.` : 'Choose the rod with the disk you want to move.')}</p>
        {error && <p className="error small">{error}{solved && !saved && <button type="button" className="link small" onClick={() => void saveResult(moves, elapsed)}>Retry</button>}</p>}
        <button type="button" className="secondary small" onClick={reset}>{challenge && solved ? 'Return to games' : solved ? 'Play again' : 'Restart puzzle'}</button>
      </article>
      <article className="card game-leaderboard">
        <h3>Family leaderboard · {disks} disks</h3>
        {scoreError && <p className="error small">{scoreError}</p>}
        {!scores.length ? <p className="muted small">Solve the puzzle to set the first family score.</p> : (
          <ol>
            {scores.map((score) => (
              <li key={score.uid} className={score.uid === app.uid ? 'game-score-me' : ''}>
                <strong>{app.household.members[score.uid]?.displayName ?? 'Family member'}</strong>
                <span>{formatGameResult(score.gameId, score.best)}</span>
                {score.uid !== app.uid && <button type="button" className="link small" onClick={reset}>Try this puzzle</button>}
              </li>
            ))}
          </ol>
        )}
      </article>
      {solved && !challenge && people.length > 0 && (
        <article className="card game-invite-form">
          <h3>Challenge someone with this {disks}-disk puzzle</h3>
          <div className="chips">
            {people.map(([id, member]) => (
              <label className={`chip-toggle${selected.includes(id) ? ' on' : ''}`} key={id}>
                <input type="checkbox" checked={selected.includes(id)} onChange={() => setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id])} />
                {member.displayName}
              </label>
            ))}
          </div>
          <button type="button" className="small" disabled={!selected.length || inviting} onClick={() => void sendInvites()}>
            {inviting ? 'Sending…' : 'Send challenge'}
          </button>
        </article>
      )}
    </section>
  )
}
