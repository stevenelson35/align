import { useCallback, useEffect, useRef, useState } from 'react'
import { today } from '../../engine/dates'
import { completeGameChallenge, inviteToGame, recordGameScore, startGameChallenge, useGameChallenge, useGameScores, type GameChallenge } from '../../firebase/games'
import { useApp } from '../../hooks/useApp'
import { isLightsOutSolved, lightsOutBoard, toggleLights } from '../../games/lightsOut'
import { celebrate } from '../../utils/celebrate'
import { Icon } from '../UI/Icon'
import { compareGameResults, formatGameResult, GAMES, gameById, type GameId } from '../../games/catalog'
import { GameTile } from './GameTile'
import { setPinnedGames } from '../../firebase/db'
import { TowerOfHanoiGame } from './TowerOfHanoiGame'
import { SlidingTilesGame } from './SlidingTilesGame'
import { WordleGame } from './WordleGame'

const seconds = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`
export function GamesView({ challengeId, gameId }: { challengeId?: string; gameId?: string }) {
  const app = useApp()
  const { challenge, error: challengeError } = useGameChallenge(challengeId)
  const selectedGame = challengeId ? challenge?.gameId ?? null : gameId && gameById(gameId) ? gameId as GameId : null
  const [gameSearch, setGameSearch] = useState('')
  const [seed, setSeed] = useState(today)
  const { scores, error: scoreError } = useGameScores('lights-out', seed, app.isMember && selectedGame === 'lights-out')
  const [board, setBoard] = useState(() => lightsOutBoard(seed))
  const [moves, setMoves] = useState(0)
  const [solved, setSolved] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [inviting, setInviting] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const startedAt = useRef(0)
  const challengeLoaded = useRef('')
  const startedChallenge = useRef('')

  useEffect(() => {
    if (selectedGame === 'lights-out') startedAt.current = Date.now()
  }, [seed, selectedGame])

  useEffect(() => {
    if (selectedGame === 'lights-out' && !solved) {
      const timer = window.setInterval(() => setElapsed(Date.now() - startedAt.current), 250)
      return () => window.clearInterval(timer)
    }
  }, [seed, selectedGame, solved])

  useEffect(() => {
    if (!challengeId || !challenge || challenge.gameId !== 'lights-out' || challengeLoaded.current === challenge.id) return
    challengeLoaded.current = challenge.id
    const puzzleId = challenge.payload?.puzzleId ?? challenge.seed
    if (!puzzleId) return
    setSeed(puzzleId)
    setBoard(lightsOutBoard(puzzleId))
    setMoves(0)
    setSolved(false)
    setSaved(false)
    setElapsed(0)
    setNote(null)
    setError(null)
    startedAt.current = Date.now()
  }, [challengeId, challenge])

  useEffect(() => {
    if (!challengeId || !challenge || challenge.gameId === 'wordle' || challenge.status !== 'pending'
      || startedChallenge.current === challenge.id) return
    startedChallenge.current = challenge.id
    startGameChallenge(challenge.id).catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [challengeId, challenge])

  const validChallenge = !challengeId || (
    !!selectedGame && !!gameById(selectedGame) && challenge?.to === app.uid && challenge.gameId === selectedGame
    && (challenge.status === 'pending' || challenge.status === 'playing'
      || (challenge.status === 'completed' && (solved || selectedGame === 'wordle'))
      || (challenge.status === 'abandoned' && selectedGame === 'wordle'))
  )
  const setupError = challengeError
    ?? (challengeId && challenge === null ? 'This challenge is no longer available.' : null)
    ?? (challengeId && challenge && !validChallenge ? 'This challenge was already completed or was not meant for your account.' : null)
  const people = Object.entries(app.household.members)
    .filter(([id, member]) => id !== app.uid && member.role === 'member' && !member.bot)
    .sort((a, b) => a[1].displayName.localeCompare(b[1].displayName))
  const pinnedGames = app.member.pinnedGames ?? ['lights-out', 'tower-of-hanoi', 'sliding-tiles', 'wordle']

  function togglePin(id: GameId) {
    const next = pinnedGames.includes(id) ? pinnedGames.filter((x) => x !== id) : [...pinnedGames, id]
    setPinnedGames(app.uid, next).catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }

  const saveResult = useCallback(async (resultMoves: number, resultMs: number, currentChallenge?: GameChallenge) => {
    if (saving || saved) return
    setSaving(true)
    setError(null)
    try {
      const result = { moves: resultMoves, ms: resultMs }
      const personalBest = await recordGameScore(app.uid, 'lights-out', seed, result)
      if (currentChallenge) await completeGameChallenge(currentChallenge.id, result)
      setSaved(true)
      if (personalBest) {
        const familyBest = !scores.length || compareGameResults('lights-out', result, scores[0].best) < 0
        celebrate({ done: 1, total: 1, message: familyBest ? 'New family high score!' : 'New personal best!' })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [app.uid, seed, saving, saved, scores])

  const press = useCallback((index: number) => {
    if (solved || !validChallenge) return
    const next = toggleLights(board, index)
    const count = moves + 1
    setBoard(next)
    setMoves(count)
    if (isLightsOutSolved(next)) {
      const time = Math.max(1, Date.now() - startedAt.current)
      setElapsed(time)
      setSolved(true)
      void saveResult(count, time, challengeId ? challenge ?? undefined : undefined)
    }
  }, [board, moves, solved, validChallenge, challengeId, challenge, saveResult])

  function newPuzzle() {
    if (challengeId) {
      app.navigate({ view: 'games' })
      return
    }
    const nextSeed = today()
    setSeed(nextSeed)
    setBoard(lightsOutBoard(nextSeed))
    setMoves(0)
    setSolved(false)
    setSaved(false)
    setElapsed(0)
    setNote(null)
    setError(null)
    startedAt.current = Date.now()
  }

  async function sendInvites() {
    setInviting(true)
    setError(null)
    setNote(null)
    try {
      await inviteToGame(app.uid, selected, 'lights-out', { puzzleId: seed, version: 1 })
      setNote(`Challenge sent to ${selected.length} ${selected.length === 1 ? 'person' : 'people'}.`)
      setSelected([])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setInviting(false)
    }
  }

  if (!app.isMember) return <p className="muted">Family games are for household members.</p>
  if (challengeId && challenge === undefined && !challengeError) return <p className="muted">Opening your challenge…</p>
  if (setupError) return <p className={challengeError ? 'error' : 'muted'}>{setupError}</p>
  if (!validChallenge) return <p className="muted">Opening Lights Out…</p>
  if (selectedGame === 'tower-of-hanoi') {
    return <TowerOfHanoiGame challenge={challengeId ? challenge ?? undefined : undefined} onBack={() => app.navigate({ view: 'games' })} onSolved={() => setSolved(true)} />
  }
  if (selectedGame === 'sliding-tiles') {
    return <SlidingTilesGame challenge={challengeId ? challenge ?? undefined : undefined} onBack={() => app.navigate({ view: 'games' })} onSolved={() => setSolved(true)} />
  }
  if (selectedGame === 'wordle') {
    return <WordleGame key={challengeId ?? 'daily'} challenge={challengeId ? challenge ?? undefined : undefined} onBack={() => app.navigate({ view: 'games' })} />
  }
  if (!selectedGame) {
    const visibleGames = GAMES.filter((game) => `${game.name} ${game.description}`.toLowerCase().includes(gameSearch.trim().toLowerCase()))
    return (
      <section className="games-view">
        <header className="view-header">
          <h2><Icon name="sparkle" /> Games</h2>
          <span className="muted small">Find a game to play or pin</span>
        </header>
        <label className="games-search">
          <span className="sr-only">Search games</span>
          <input type="search" value={gameSearch} onChange={(e) => setGameSearch(e.target.value)} placeholder="Search games…" />
        </label>
        <div className="game-library">
          {visibleGames.map((game) => (
            <GameTile
              key={game.id}
              {...game}
              pinned={pinnedGames.includes(game.id)}
              onPlay={() => app.navigate({ view: 'games', gameId: game.id })}
              onPin={() => togglePin(game.id)}
            />
          ))}
        </div>
        {!visibleGames.length && <p className="muted small">No games match that search.</p>}
        {error && <p className="error small">{error}</p>}
      </section>
    )
  }

  return (
    <section className="games-view">
      <header className="view-header">
        <h2><Icon name="sparkle" /> Games</h2>
        <span className="muted small">Quick puzzles for the family</span>
        {!challengeId && <button type="button" className="secondary small" onClick={() => app.navigate({ view: 'games' })}>Show all games</button>}
      </header>
      <article className="game-card card">
        <header className="row">
          <div className="grow">
            <h3>{gameById(selectedGame)?.name ?? selectedGame}</h3>
            <p className="muted small">{GAMES.find((game) => game.id === selectedGame)?.description}</p>
          </div>
          {challenge && <span className="badge">Challenge from {app.household.members[challenge.from]?.displayName ?? 'a family member'}</span>}
        </header>
        <div className="game-status row" aria-live="polite">
          <strong>{moves} {moves === 1 ? 'move' : 'moves'}</strong>
          <span className="muted">·</span>
          <strong>{seconds(elapsed)}</strong>
          {solved && <span className="badge">Solved!</span>}
        </div>
        <div className="lights-board" role="group" aria-label="Lights Out puzzle">
          {board.map((on, i) => (
            <button
              key={i}
              type="button"
              className={`light-cell${on ? ' on' : ''}`}
              onClick={() => press(i)}
              disabled={solved}
              aria-label={`Row ${Math.floor(i / 5) + 1}, column ${i % 5 + 1}: ${on ? 'lit' : 'off'}`}
              aria-pressed={on}
            />
          ))}
        </div>
        {solved && (
          <div className="game-result">
            <p>{saved ? 'Result saved to the family leaderboard.' : saving ? 'Saving your result…' : 'Your puzzle is solved.'}</p>
            {error && <p className="error small">{error} <button type="button" className="link small" onClick={() => void saveResult(moves, elapsed, challengeId ? challenge ?? undefined : undefined)}>Try saving again</button></p>}
            <button type="button" className="secondary small" onClick={newPuzzle}>Play today’s puzzle again</button>
          </div>
        )}
        {!solved && <button type="button" className="secondary small" onClick={newPuzzle}>Reset today’s puzzle</button>}
      </article>

      <article className="card game-leaderboard">
        <h3>Family leaderboard</h3>
        {scoreError && <p className="error small">{scoreError}</p>}
        {!scores.length ? <p className="muted small">Solve a puzzle to set the first family score.</p> : (
          <ol>
            {scores.map((score) => (
              <li key={score.uid} className={score.uid === app.uid ? 'game-score-me' : ''}>
                <strong>{app.household.members[score.uid]?.displayName ?? 'Family member'}</strong>
                <span>{formatGameResult(score.gameId, score.best)}</span>
                {score.uid !== app.uid && <button type="button" className="link small" onClick={newPuzzle}>Try today’s puzzle</button>}
              </li>
            ))}
          </ol>
        )}
      </article>

      {solved && !challengeId && people.length > 0 && (
        <article className="card game-invite-form">
          <h3>Invite someone to solve this same puzzle</h3>
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
      {note && <p className="muted small" role="status">{note}</p>}
      {error && !solved && <p className="error small">{error}</p>}
    </section>
  )
}
