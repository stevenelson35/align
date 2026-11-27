import { useCallback, useEffect, useRef, useState } from 'react'
import { today } from '../../engine/dates'
import { completeGameChallenge, findOwnChallenge, inviteToGame, recordGameScore, startGameChallenge, useGameChallenge, useGameScores, type GameChallenge } from '../../firebase/games'
import { useApp } from '../../hooks/useApp'
import { isLightsOutSolved, lightsOutBoard, toggleLights } from '../../games/lightsOut'
import { celebrate } from '../../utils/celebrate'
import { Icon } from '../UI/Icon'
import { compareGameResults, DAILY_GAMES, formatGameResult, GAMES, gameById, isDailyGame, nextDaily, type GameId } from '../../games/catalog'
import { GameTile } from './GameTile'
import { setPinnedGames } from '../../firebase/db'
import { TowerOfHanoiGame } from './TowerOfHanoiGame'
import { SlidingTilesGame } from './SlidingTilesGame'
import { GameInvitationsBlock } from './GameInvitationsBlock'
import { GliderGame } from './GliderGame'
import { earnDaily } from '../../firebase/play'
import { WordleGame } from './WordleGame'
import { LogicGame } from './LogicGames'
import { DailyBar } from './DailyBar'
import { FamilyResults } from './FamilyResults'
import { useDailyDone } from '../../hooks/useDailyDone'
import { isLogicGame } from '../../games/logic'

const seconds = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`
export function GamesView({ challengeId, gameId, day, daily = false }: { challengeId?: string; gameId?: string; day?: string; /** Playing through today's daily games: the bar, and no challenges. */ daily?: boolean }) {
  const app = useApp()
  const { challenge, error: challengeError } = useGameChallenge(challengeId)
  const selectedGame = challengeId ? challenge?.gameId ?? null : gameId && gameById(gameId) ? gameId as GameId : null
  const [gameSearch, setGameSearch] = useState('')
  const [seed, setSeed] = useState(today)
  const { scores, error: scoreError } = useGameScores('lights-out', seed, app.canPlay && selectedGame === 'lights-out')
  const [board, setBoard] = useState(() => lightsOutBoard(seed))
  const [moves, setMoves] = useState(0)
  const [solved, setSolved] = useState(false)
  // Solving a puzzle (Lights Out, Tower of Hanoi, Picture Slider) earns Glider play time, once a day each.
  useEffect(() => {
    if (solved && selectedGame && app.canPlay) void earnDaily(app.uid, selectedGame, today()).catch(() => undefined)
  }, [solved, selectedGame, app.canPlay, app.uid])
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

  // Lights Out waits for Start (the board hidden, the clock still), like the other daily puzzles.
  const [lightsStarted, setLightsStarted] = useState(false)
  useEffect(() => {
    if (selectedGame === 'lights-out' && lightsStarted) startedAt.current = Date.now()
  }, [seed, selectedGame, lightsStarted])

  useEffect(() => {
    if (selectedGame === 'lights-out' && lightsStarted && !solved) {
      const timer = window.setInterval(() => setElapsed(Date.now() - startedAt.current), 250)
      return () => window.clearInterval(timer)
    }
  }, [seed, selectedGame, solved, lightsStarted])

  useEffect(() => {
    if (!challengeId || !challenge || challenge.gameId !== 'lights-out' || challengeLoaded.current === challenge.id) return
    challengeLoaded.current = challenge.id
    const puzzleId = challenge.payload?.puzzleId ?? challenge.seed
    if (!puzzleId) return
    // Loading a challenge that just arrived from the database into the board: a sync from outside React, once per
    // challenge (guarded by challengeLoaded), not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // A Wordle challenge link to someone else's copy (each player has their own): go to yours instead. Until the
  // lookup says there's none, this counts as on the way (no "not for you" flash).
  const wrongCopy = !!challengeId && !!challenge && challenge.gameId === 'wordle' && challenge.to !== app.uid && !!challenge.payload?.puzzleId
  const [noOwnCopy, setNoOwnCopy] = useState<string | null>(null)
  const redirecting = wrongCopy && noOwnCopy !== challengeId
  useEffect(() => {
    const puzzleId = challenge?.payload?.puzzleId
    if (!wrongCopy || !challengeId || !puzzleId) return
    let live = true
    findOwnChallenge(app.uid, puzzleId)
      .then((own) => {
        if (!live) return
        if (own && own !== challengeId) app.navigate({ view: 'games', challengeId: own })
        else setNoOwnCopy(challengeId)
      })
      .catch(() => live && setNoOwnCopy(challengeId))
    return () => {
      live = false
    }
  }, [wrongCopy, challengeId, challenge, app])

  const validChallenge = !challengeId || (
    !!selectedGame && !!gameById(selectedGame) && challenge?.to === app.uid && challenge.gameId === selectedGame
    && (challenge.status === 'pending' || challenge.status === 'playing'
      || (challenge.status === 'completed' && (solved || selectedGame === 'wordle'))
      || (challenge.status === 'abandoned' && selectedGame === 'wordle'))
  )
  const setupError = challengeError
    ?? (challengeId && challenge === null ? 'This challenge is no longer available.' : null)
    ?? (challengeId && challenge && !validChallenge && !redirecting ? 'This challenge was already completed or was not meant for your account.' : null)
  const people = Object.entries(app.household.members)
    .filter(([id, member]) => id !== app.uid && (member.role === 'member' || member.role === 'viewer') && !member.bot)
    .sort((a, b) => a[1].displayName.localeCompare(b[1].displayName))
  const dailyDone = useDailyDone()
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

  if (!app.canPlay) return <p className="muted">Family games are for the family’s accounts.</p>
  if (challengeId && challenge === undefined && !challengeError) return <p className="muted">Opening your challenge…</p>
  if (setupError) return <p className={challengeError ? 'error' : 'muted'}>{setupError}</p>
  if (redirecting) return <p className="muted">Opening your copy of this challenge…</p>
  if (!validChallenge) return <p className="muted">Opening Lights Out…</p>
  if (selectedGame === 'tower-of-hanoi') {
    return <TowerOfHanoiGame challenge={challengeId ? challenge ?? undefined : undefined} onBack={() => app.navigate({ view: 'games' })} onSolved={() => setSolved(true)} />
  }
  if (selectedGame === 'sliding-tiles') {
    return <SlidingTilesGame challenge={challengeId ? challenge ?? undefined : undefined} onBack={() => app.navigate({ view: 'games' })} onSolved={() => setSolved(true)} />
  }
  if (selectedGame === 'glider') return <GliderGame onBack={() => app.navigate({ view: 'games' })} />
  // Today's daily games: the bar to step through them (not on a challenge).
  const dailyBar = daily && !challengeId && selectedGame && isDailyGame(selectedGame) ? <DailyBar current={selectedGame} /> : null
  if (selectedGame && isLogicGame(selectedGame))
    return (
      <>
        {dailyBar}
        <LogicGame key={selectedGame} id={selectedGame} onBack={() => app.navigate({ view: 'games' })} />
      </>
    )
  if (selectedGame === 'wordle') {
    return (
      <>
        {dailyBar}
        <WordleGame key={challengeId ?? `daily${day ?? ''}`} challenge={challengeId ? challenge ?? undefined : undefined} day={challengeId ? undefined : day} daily={daily} onBack={() => app.navigate({ view: 'games' })} />
      </>
    )
  }
  if (!selectedGame) {
    const visibleGames = GAMES.filter((game) => `${game.name} ${game.description}`.toLowerCase().includes(gameSearch.trim().toLowerCase()))
    return (
      <section className="games-view">
        <header className="view-header">
          <h2><Icon name="sparkle" /> Games</h2>
          <span className="muted small">Find a game to play or pin</span>
        </header>
        <div className="daily-start card">
          <div className="grow">
            <strong>Today’s daily games</strong>
            <span className="muted small"> · {DAILY_GAMES.filter((g) => dailyDone.has(g)).length} of {DAILY_GAMES.length} done</span>
            <p className="muted small">A new puzzle in each every day, the same for everyone: step through them with ‹ ›.</p>
          </div>
          <button type="button" className="small" onClick={() => app.navigate({ view: 'games', gameId: nextDaily(dailyDone), daily: true })}>
            <Icon name="play" /> {dailyDone.size ? 'Keep going' : 'Play them'}
          </button>
        </div>
        <GameInvitationsBlock />
        <label className="games-search">
          <input
            type="search"
            aria-label="Search games"
            value={gameSearch}
            onChange={(e) => setGameSearch(e.target.value)}
            placeholder="Search games…"
          />
        </label>
        <div className="game-library">
          {visibleGames.map((game) => (
            <GameTile
              key={game.id}
              {...game}
              pinned={pinnedGames.includes(game.id)}
              daily={isDailyGame(game.id)}
              doneToday={dailyDone.has(game.id)}
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
    <>
    {dailyBar}
    <section className="games-view">
      <header className="view-header">
        <h2><Icon name="sparkle" /> {gameById(selectedGame)?.name ?? 'Lights Out'}</h2>
        <span className="muted small">{challenge ? `Challenge from ${app.household.members[challenge.from]?.displayName ?? 'a family member'}` : 'Today’s puzzle, the same for everyone.'}</span>
        {!challengeId && <button type="button" className="secondary small" onClick={() => app.navigate({ view: 'games' })}>Show All Games</button>}
      </header>
      <article className="game-card card">
        <p className="small muted logic-rules">Switch off every light. Each tap flips that square and the ones above, below and beside it. Fewest moves wins, then fastest.</p>
        {!lightsStarted ? (
          <div className="logic-start">
            <p className="small muted">The board shows and the clock starts when you tap Start.</p>
            <button type="button" onClick={() => setLightsStarted(true)}>
              <Icon name="play" /> Start
            </button>
          </div>
        ) : (
        <>
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
        </>
        )}
      </article>

      {scoreError && <p className="error small">{scoreError}</p>}
      <FamilyResults gameId="lights-out" gameName="Lights Out" day={seed} rows={scores.map((score) => ({ uid: score.uid, text: formatGameResult(score.gameId, score.best) }))} />

      {solved && !challengeId && !daily && people.length > 0 && (
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
    </>
  )
}
