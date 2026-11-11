import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { completeGameChallenge, inviteToGame, recordGameScore, useGameScores, type GameChallenge } from '../../firebase/games'
import { useApp } from '../../hooks/useApp'
import { useFavorites } from '../../hooks/useFavorites'
import { photoCaption, photoUrl } from '../../photos/favorites'
import { celebrate } from '../../utils/celebrate'
import { compareGameResults, formatGameResult } from '../../games/catalog'
import { moveSlidingTile, scrambleSlidingTiles, slidingTileSolved } from '../../games/slidingTiles'
import { Icon } from '../UI/Icon'
import { PhotoPicker } from '../Photos/PhotoPicker'

const BOARD_SIZES = [3, 4, 5] as const
type BoardSize = (typeof BOARD_SIZES)[number]
const scoreSeed = (photoId: string, size: BoardSize) => `slide-${size}-${photoId}`
const validPhotoId = (id: string) => /^[A-Za-z0-9_-]{1,100}$/.test(id)
const seconds = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

export function SlidingTilesGame({ challenge, onBack, onSolved }: { challenge?: GameChallenge; onBack: () => void; onSolved: () => void }) {
  const app = useApp()
  const { manifest, error: photoError } = useFavorites()
  const challengePhoto = challenge?.payload?.imageId
  const challengeSize = challenge?.payload?.boardSize
  const [selectedPhotoId, setSelectedPhotoId] = useState(challengePhoto ?? '')
  const photoId = selectedPhotoId || (!challenge ? manifest?.photos.find((item) => validPhotoId(item.id))?.id ?? '' : '')
  const [size, setSize] = useState<BoardSize>(challengeSize === 4 || challengeSize === 5 ? challengeSize : 3)
  const [choosingPhoto, setChoosingPhoto] = useState(false)
  const [moves, setMoves] = useState(0)
  const [position, setPosition] = useState<{ puzzleId: string; tiles: number[] } | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [solved, setSolved] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const startedAt = useRef(0)
  const puzzleId = photoId ? scoreSeed(photoId, size) : ''
  const { scores, error: scoreError } = useGameScores('sliding-tiles', puzzleId, app.isMember && !!puzzleId)
  const photo = manifest?.photos.find((item) => item.id === photoId)
  const board = useMemo(
    () => photoId ? position?.puzzleId === puzzleId ? position.tiles : scrambleSlidingTiles(photoId, size) : [],
    [photoId, position, puzzleId, size],
  )
  const people = Object.entries(app.household.members)
    .filter(([id, member]) => id !== app.uid && member.role === 'member' && !member.bot)
    .sort((a, b) => a[1].displayName.localeCompare(b[1].displayName))

  useEffect(() => { startedAt.current = Date.now() }, [puzzleId])

  useEffect(() => {
    if (!photoId || solved) return
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt.current), 250)
    return () => window.clearInterval(timer)
  }, [photoId, solved])

  const saveResult = useCallback(async (resultMoves: number, resultMs: number) => {
    if (saving || saved || !puzzleId) return
    setSaving(true)
    setError(null)
    const result = { moves: resultMoves, ms: resultMs }
    try {
      const personalBest = await recordGameScore(app.uid, 'sliding-tiles', puzzleId, result)
      if (challenge) await completeGameChallenge(challenge.id, result)
      setSaved(true)
      if (personalBest) {
        const familyBest = !scores.length || compareGameResults('sliding-tiles', result, scores[0].best) < 0
        celebrate({ done: 1, total: 1, message: familyBest ? 'New family high score!' : 'New personal best!' })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [app.uid, challenge, puzzleId, saved, saving, scores])

  const moveTile = useCallback((index: number) => {
    if (solved || !photoId) return
    const next = moveSlidingTile(board, index, size)
    if (!next) return
    const count = moves + 1
    setPosition({ puzzleId, tiles: next })
    setMoves(count)
    setMessage(null)
    if (slidingTileSolved(next)) {
      const time = Math.max(1, Date.now() - startedAt.current)
      setElapsed(time)
      setSolved(true)
      onSolved()
      void saveResult(count, time)
    }
  }, [board, moves, onSolved, photoId, puzzleId, saveResult, size, solved])

  function resetConfiguration() {
    setPosition(null)
    setMoves(0)
    setElapsed(0)
    setSolved(false)
    setSaved(false)
    setError(null)
    setMessage(null)
    startedAt.current = Date.now()
  }

  function choosePhoto(id: string) {
    if (!validPhotoId(id)) {
      setError('That photo cannot be used in a puzzle. Choose a different favorite.')
      return
    }
    setSelectedPhotoId(id)
    resetConfiguration()
    setChoosingPhoto(false)
  }

  function chooseSize(value: BoardSize) {
    setSize(value)
    resetConfiguration()
  }

  function replay() {
    if (challenge) {
      onBack()
      return
    }
    resetConfiguration()
  }

  async function sendInvites() {
    if (!photoId) return
    setInviting(true)
    setError(null)
    setMessage(null)
    try {
      await inviteToGame(app.uid, selected, 'sliding-tiles', { imageId: photoId, boardSize: size, version: 1 })
      setMessage(`Challenge sent to ${selected.length} ${selected.length === 1 ? 'person' : 'people'}.`)
      setSelected([])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setInviting(false)
    }
  }

  if (photoError) return <p className="error">{photoError}</p>
  if (!photoId || !manifest) return <p className="muted">Loading favorite photos…</p>
  if (!validPhotoId(photoId)) return <p className="error">That photo cannot be used in a puzzle. Choose a different favorite.</p>
  const image = photoUrl(photoId, 1024)

  return (
    <section className="games-view">
      <header className="view-header">
        <h2><Icon name="sparkle" /> Picture Slider</h2>
        <span className="muted small">{challenge ? `Challenge from ${app.household.members[challenge.from]?.displayName ?? 'a family member'}` : 'Rebuild a family photo by sliding the tiles.'}</span>
        <button type="button" className="secondary small" onClick={onBack}>Show All Games</button>
      </header>
      <article className="game-card card sliding-game">
        <div className="row wrap">
          <strong className="grow">{photo ? photoCaption(photo) : 'Selected family photo'}</strong>
          {!challenge && <button type="button" className="secondary small" onClick={() => setChoosingPhoto(true)}>Choose photo…</button>}
        </div>
        {!challenge && (
          <label className="inline small">
            Board size
            <select value={size} onChange={(event) => chooseSize(Number(event.target.value) as BoardSize)}>
              {BOARD_SIZES.map((n) => <option key={n} value={n}>{n} × {n} ({n * n - 1} tiles)</option>)}
            </select>
          </label>
        )}
        {challenge && <p className="muted small">{size} × {size} board · move count, then time</p>}
        <div className="game-status row" aria-live="polite">
          <strong>{moves} {moves === 1 ? 'move' : 'moves'}</strong>
          <span className="muted">·</span>
          <strong>{seconds(elapsed)}</strong>
          {solved && <span className="badge">Solved!</span>}
        </div>
        <div className="sliding-board" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }} role="group" aria-label={`${size} by ${size} picture slider`}>
          {board.map((tile, index) => {
            const tileIndex = tile ? tile - 1 : 0
            const row = Math.floor(tileIndex / size)
            const col = tileIndex % size
            const percentage = size > 1 ? 100 / (size - 1) : 0
            return (
              <button
                type="button"
                key={`${tile}-${index}`}
                className={`sliding-tile${tile === 0 ? ' empty' : ''}`}
                onClick={() => moveTile(index)}
                disabled={!tile || solved}
                aria-label={tile ? `Slide tile ${tile}` : 'Empty space'}
                style={tile ? {
                  backgroundImage: `url("${image}")`,
                  backgroundSize: `${size * 100}% ${size * 100}%`,
                  backgroundPosition: `${col * percentage}% ${row * percentage}%`,
                } : undefined}
              />
            )
          })}
        </div>
        <p className="muted small" role="status">{solved ? saved ? 'Result saved to the family leaderboard.' : saving ? 'Saving your result…' : 'Puzzle solved.' : message ?? 'Tap a tile next to the empty space to slide it.'}</p>
        {error && <p className="error small">{error}{solved && !saved && <button type="button" className="link small" onClick={() => void saveResult(moves, elapsed)}>Retry</button>}</p>}
        <button type="button" className="secondary small" onClick={replay}>{challenge ? 'Return to games' : solved ? 'Play again' : 'Restart puzzle'}</button>
        {solved && !challenge && people.length > 0 && (
          <div className="game-invite-form">
            <h3>Challenge someone with this photo and board</h3>
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
          </div>
        )}
        {message && <p className="muted small" role="status">{message}</p>}
      </article>
      <article className="card game-leaderboard">
        <h3>Family leaderboard · {size} × {size}</h3>
        <p className="muted small">This photo and board size · fewest moves, then fastest time</p>
        {scoreError && <p className="error small">{scoreError}</p>}
        {!scores.length ? <p className="muted small">Solve this photo puzzle to set the first family score.</p> : (
          <ol>
            {scores.map((score) => (
              <li key={score.uid} className={score.uid === app.uid ? 'game-score-me' : ''}>
                <strong>{app.household.members[score.uid]?.displayName ?? 'Family member'}</strong>
                <span>{formatGameResult(score.gameId, score.best)}</span>
              </li>
            ))}
          </ol>
        )}
      </article>
      {choosingPhoto && <PhotoPicker onPick={(item) => choosePhoto(item.id)} onClose={() => setChoosingPhoto(false)} />}
    </section>
  )
}
