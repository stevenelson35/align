import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  createWordleChallenge,
  abandonDailyWordle,
  abandonWordleChallenge,
  getDailyWordlePreview,
  getDailyWordle,
  getWordleChallenge,
  guessDailyWordle,
  guessWordleChallenge,
  type DailyWordlePreview,
  type WordleGameState,
  type WordleChallengeType,
} from '../../firebase/wordle'
import { useGameScores, useWordleChallengeProgress, type GameChallenge, type WordleChallengeProgress } from '../../firebase/games'
import { useApp } from '../../hooks/useApp'
import { formatGameResult } from '../../games/catalog'
import { hardModeError, normalizeWord, validWord, wordleChallengeFinished, wordleKeyboardMarks, WORDLE_MAX_LENGTH, WORDLE_MIN_LENGTH, WORDLE_MAX_GUESSES } from '../../games/wordle'
import { celebrate } from '../../utils/celebrate'
import { Icon } from '../UI/Icon'
import { WordleProgressBoard } from './WordleProgressBoard'

const seconds = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

function challengeNotification(
  game: WordleGameState,
  challenge: GameChallenge | undefined,
  progress: WordleChallengeProgress[],
  members: Record<string, { displayName: string }>,
) {
  const allPlayersFinished = challenge
    ? wordleChallengeFinished(challenge.players ?? [challenge.to], progress)
    : false
  if (game.complete) {
    const others = challenge ? allPlayersFinished ? ' Challenge complete.' : ' Other players can keep going.' : ''
    if (game.solved) return `You solved it!${others}`
    if (game.abandoned) return `You gave up.${others}`
    return `No guesses left.${others}`
  }
  if (challenge) {
    const finished = progress
      .filter((item) => item.complete)
      .sort((a, b) => (a.updatedAt ?? '').localeCompare(b.updatedAt ?? ''))
    const latest = finished[finished.length - 1]
    if (latest) {
      const name = members[latest.uid]?.displayName ?? 'A family member'
      if (latest.status === 'declined') return `${name} declined. You can keep playing or give up.`
      if (latest.status === 'abandoned') return `${name} gave up. You can keep playing or give up.`
      if (!latest.solved) return `${name} ran out of guesses. You can keep playing or give up.`
      const solved = finished.filter((item) => item.solved).length
      return `${name} ${solved === 1 ? 'solved first' : `solved (${solved} finished)`}! Keep playing or give up.`
    }
  }
  return game.length === 5 ? 'Hard mode: use every revealed hint.' : ' '
}

export function WordleGame({ challenge, onBack }: { challenge?: GameChallenge; onBack: () => void }) {
  const app = useApp()
  const [game, setGame] = useState<WordleGameState | null>(null)
  const [dailyPreview, setDailyPreview] = useState<DailyWordlePreview | null>(null)
  const [receivedAt, setReceivedAt] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [guess, setGuess] = useState('')
  const [loading, setLoading] = useState(!!challenge)
  const [submitting, setSubmitting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guessError, setGuessError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [word, setWord] = useState('')
  const [challengeType, setChallengeType] = useState<WordleChallengeType>('invite')
  const [selected, setSelected] = useState<string[]>([])
  const [inviting, setInviting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const scoreSeed = game?.seed ?? dailyPreview?.seed ?? ''
  const { scores, error: scoreError } = useGameScores('wordle', scoreSeed, !challenge && !!scoreSeed && app.isMember)
  const { progress: challengeProgress, error: challengeProgressError, loaded: challengeProgressLoaded } = useWordleChallengeProgress(app.uid, app.isMember && !!challenge)
  const celebratedProgress = useRef(new Set<string>())
  const progressInitialized = useRef(false)
  const people = Object.entries(app.household.members)
    .filter(([id, member]) => id !== app.uid && member.role === 'member' && !member.bot)
    .sort((a, b) => a[1].displayName.localeCompare(b[1].displayName))
  const challengePlayers = challengeType === 'random-live'
    ? Object.entries(app.household.members)
      .filter(([, member]) => member.role === 'member' && !member.bot)
      .sort((a, b) => a[1].displayName.localeCompare(b[1].displayName))
    : people
  const canSendChallenge = selected.length >= (challengeType === 'random-live' ? 2 : 1)
    && (challengeType !== 'random-live' || selected.includes(app.uid))
    && (challengeType === 'random-live' || validWord(word))
    && !inviting
  const keyboardMarks = useMemo(() => wordleKeyboardMarks(game?.guesses ?? []), [game])

  const challengeId = challenge?.id
  const activeChallengeProgress = useMemo(
    () => {
      const puzzleId = challenge?.payload?.puzzleId
      return puzzleId ? challengeProgress.filter((item) => item.groupId === puzzleId) : []
    },
    [challenge, challengeProgress],
  )
  useEffect(() => {
    if (!challenge || !challengeProgressLoaded) return
    if (!progressInitialized.current) {
      activeChallengeProgress.filter((item) => item.complete).forEach((item) => celebratedProgress.current.add(item.uid))
      progressInitialized.current = true
      return
    }
    activeChallengeProgress.forEach((item) => {
      if (!item.complete || !item.solved || celebratedProgress.current.has(item.uid)) return
      celebratedProgress.current.add(item.uid)
      const name = app.household.members[item.uid]?.displayName ?? 'A family member'
      celebrate({ done: 1, total: 1, message: `${name} solved the Wordle!` })
    })
  }, [challenge, activeChallengeProgress, challengeProgressLoaded, app.household.members])

  useEffect(() => {
    let cancelled = false
    async function loadDailyPreview() {
      try {
        const preview = await getDailyWordlePreview()
        if (!cancelled) setDailyPreview(preview)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }
    async function loadChallenge() {
      try {
        if (!challengeId) return
        const state = await getWordleChallenge(challengeId)
        if (cancelled) return
        setGame(state)
        setElapsed(state.elapsedMs)
        setReceivedAt(Date.now())
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (challengeId) void loadChallenge()
    else void loadDailyPreview()
    return () => { cancelled = true }
  }, [challengeId])

  useEffect(() => {
    if (!game || game.complete) return
    const timer = window.setInterval(() => setElapsed(game.elapsedMs + Date.now() - receivedAt), 1000)
    return () => window.clearInterval(timer)
  }, [game, receivedAt])

  async function submitGuess() {
    if (!game || game.complete || submitting || ending) return
    const normalized = normalizeWord(guess)
    if (!validWord(normalized, game.length)) {
      setGuessError(`Enter a ${game.length}-letter word.`)
      return
    }
    if (game.length === 5) {
      const violation = hardModeError(game.guesses, normalized)
      if (violation) {
        setGuessError(`Hard mode: ${violation}`)
        return
      }
    }
    setSubmitting(true)
    setGuessError(null)
    try {
      let next: WordleGameState
      if (game.mode === 'daily') next = await guessDailyWordle(normalized)
      else {
        if (!challengeId) throw new Error('This Wordle challenge is unavailable.')
        next = await guessWordleChallenge(challengeId, normalized)
      }
      setGame(next)
      setElapsed(next.elapsedMs)
      setReceivedAt(Date.now())
      setGuess('')
      if (next.solved) {
        celebratedProgress.current.add(app.uid)
        celebrate({ done: 1, total: 1, message: 'You solved the Wordle!' })
      }
    } catch (err) {
      setGuessError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function startDailyGame() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const state = await getDailyWordle()
      setGame(state)
      setElapsed(state.elapsedMs)
      setReceivedAt(Date.now())
      setGuess('')
      setGuessError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function quitDailyGame() {
    setGame(null)
    setGuess('')
    setGuessError(null)
  }

  function addLetter(letter: string) {
    if (!game || game.complete || submitting || ending) return
    setGuess((current) => current.length < game.length ? current + letter : current)
    setGuessError(null)
  }

  function removeLetter() {
    if (!game || game.complete || submitting || ending) return
    setGuess((current) => current.slice(0, -1))
    setGuessError(null)
  }

  async function sendChallenge(event: FormEvent) {
    event.preventDefault()
    if (!canSendChallenge) return
    setInviting(true)
    setError(null)
    setMessage(null)
    try {
      const result = await createWordleChallenge(
        challengeType === 'random-live' ? null : normalizeWord(word),
        selected,
        challengeType,
      )
      setWord('')
      setSelected([])
      if (challengeType === 'random-live' && result.challengeId) {
        app.navigate({ view: 'games', challengeId: result.challengeId })
      } else {
        setMessage(
          challengeType === 'live-chosen'
            ? `Live challenge started with ${result.invited} ${result.invited === 1 ? 'player' : 'players'}.`
            : `Word invite sent to ${result.invited} ${result.invited === 1 ? 'person' : 'people'}.`,
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setInviting(false)
    }
  }

  async function giveUp() {
    if (!game || game.complete || submitting || ending) return
    if (!window.confirm('Give up on this Wordle? This ends the game and shares that you gave up.')) return
    setEnding(true)
    setError(null)
    try {
      let next: WordleGameState
      if (game.mode === 'daily') next = await abandonDailyWordle()
      else if (challengeId) next = await abandonWordleChallenge(challengeId)
      else throw new Error('This Wordle challenge is unavailable.')
      setGame(next)
      setElapsed(next.elapsedMs)
      setReceivedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnding(false)
    }
  }

  if (!app.isMember) return <p className="muted">Wordle is for household members.</p>

  return (
    <section className="games-view">
      <header className="view-header">
        <h2><Icon name="sparkle" /> Wordle</h2>
        <span className="muted small">
          {challenge
            ? challenge.from === app.uid ? 'Your live challenge' : `Challenge from ${app.household.members[challenge.from]?.displayName ?? 'a family member'}`
            : 'A shared daily word, or a word challenge you create.'}
        </span>
        <button type="button" className="secondary small" onClick={onBack}>Show all games</button>
      </header>

      {loading && <p className="muted">Opening Wordle…</p>}
      {error && <p className="error small" role="alert">{error}</p>}
      {challengeProgressError && <p className="error small">{challengeProgressError}</p>}

      {!challenge && (
        <article className="card game-invite-form">
          <div className="row">
            <h3 className="grow">Create challenge</h3>
            <button type="button" className="secondary small" aria-expanded={showCreate} onClick={() => setShowCreate((open) => !open)}>
              {showCreate ? 'Hide' : 'Create challenge'}
            </button>
          </div>
          {showCreate && (
            <form onSubmit={(event) => void sendChallenge(event)}>
              <fieldset className="wordle-challenge-mode">
                <legend className="small">Challenge type</legend>
                <label className="wordle-challenge-option">
                  <input
                    type="radio"
                    name="wordle-challenge-type"
                    checked={challengeType === 'invite'}
                    onChange={() => {
                      setChallengeType('invite')
                      setSelected((current) => current.filter((id) => id !== app.uid))
                    }}
                  />
                  <span>
                    <strong>Choose a word invite</strong>
                    <span className="muted small">Invite one or more others to play your word separately. You don’t play.</span>
                  </span>
                </label>
                <label className="wordle-challenge-option">
                  <input
                    type="radio"
                    name="wordle-challenge-type"
                    checked={challengeType === 'live-chosen'}
                    onChange={() => {
                      setChallengeType('live-chosen')
                      setSelected((current) => current.filter((id) => id !== app.uid))
                    }}
                  />
                  <span>
                    <strong>Live chosen word</strong>
                    <span className="muted small">Challenge one or more others to play your word live. You know the answer, so you don’t play.</span>
                  </span>
                </label>
                <label className="wordle-challenge-option">
                  <input
                    type="radio"
                    name="wordle-challenge-type"
                    checked={challengeType === 'random-live'}
                    onChange={() => setChallengeType('random-live')}
                  />
                  <span>
                    <strong>Live random word</strong>
                    <span className="muted small">Play with one or more others. Select yourself and at least one other player.</span>
                  </span>
                </label>
              </fieldset>
              {challengeType !== 'random-live' && (
                <>
                  <p className="muted small">Choose a 2–12 letter word. Five-letter answers must be accepted Wordle words, and every five-letter game uses hard mode. The answer is stored privately and isn’t sent with the invitation.</p>
                  <div className="row wrap">
                    <label className="small">
                      Your word
                      <input
                        type="text"
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={WORDLE_MAX_LENGTH}
                        value={word}
                        onChange={(event) => setWord(event.target.value.replace(/[^a-z]/gi, '').slice(0, WORDLE_MAX_LENGTH))}
                        aria-label="Custom Wordle answer"
                      />
                    </label>
                    <span className="muted small">{WORDLE_MIN_LENGTH}–{WORDLE_MAX_LENGTH} letters</span>
                  </div>
                </>
              )}
              <p className="muted small">{challengeType === 'random-live' ? 'Players (include yourself)' : 'Invite family members'}</p>
              <div className="chips">
                {challengePlayers.map(([id, member]) => (
                  <label className={`chip-toggle${selected.includes(id) ? ' on' : ''}`} key={id}>
                    <input type="checkbox" checked={selected.includes(id)} onChange={() => setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id])} />
                    {member.displayName}{id === app.uid ? ' (you)' : ''}
                  </label>
                ))}
              </div>
              <button type="submit" className="small" disabled={!canSendChallenge}>
                {inviting
                  ? 'Starting…'
                  : challengeType === 'random-live'
                    ? `Start live challenge${selected.length ? ` with ${selected.filter((id) => id !== app.uid).length}` : ''}`
                    : challengeType === 'live-chosen'
                      ? `Start live challenge${selected.length ? ` with ${selected.length}` : ''}`
                      : `Send word invite${selected.length ? ` to ${selected.length}` : ''}`}
              </button>
              {message && <p className="muted small" role="status">{message}</p>}
            </form>
          )}
        </article>
      )}

      {!challenge && !game && (
        <article className="card game-invite-form">
          <div className="row">
            <div className="grow">
              <h3>Daily word{dailyPreview ? ` · ${dailyPreview.date}` : ''}</h3>
              <p className="muted small">Five letters · six guesses · hard mode</p>
            </div>
            <button type="button" className="small" onClick={() => void startDailyGame()} disabled={loading}>
              {loading ? 'Opening…' : 'Play daily Wordle'}
            </button>
          </div>
        </article>
      )}

      {game && (
        <>
          <article className="game-card card wordle-game">
            <header className="row wrap">
              <div className="grow">
                <h3>{game.mode === 'daily' ? `Daily word · ${game.date}` : `${game.length}-letter challenge`}</h3>
                <p className="muted small">
                  {game.length} letters · six guesses
                  {game.length === 5 ? ' · hard mode (use every revealed hint)' : ''}
                  {' · '}fewest guesses, then fastest time
                </p>
              </div>
              <div className="wordle-clock" aria-label="Elapsed time">{seconds(elapsed)}</div>
            </header>

            {challenge?.payload?.puzzleId
              && challenge.challengeType !== 'invite'
              && (challenge.players ?? [challenge.to]).some((uid) => uid !== app.uid) && (
              <WordleProgressBoard
                participants={(challenge.players ?? [challenge.to]).filter((uid) => uid !== app.uid)}
                progress={activeChallengeProgress}
                members={app.household.members}
              />
            )}

            <div className="wordle-board" aria-label="Wordle guesses" aria-live="polite">
              {Array.from({ length: WORDLE_MAX_GUESSES }, (_, row) => {
                const submitted = game.guesses[row]
                const active = row === game.guesses.length && !game.complete
                const letters = submitted?.word ?? (active ? guess.toUpperCase() : '')
                return (
                  <div className="wordle-row" style={{ gridTemplateColumns: `repeat(${game.length}, minmax(0, 1fr))` }} key={row}>
                    {Array.from({ length: game.length }, (_, col) => (
                      <span className={`wordle-cell${submitted ? ` ${submitted.marks[col]}` : ''}`} key={col}>
                        {letters[col] ?? ''}
                      </span>
                    ))}
                  </div>
                )
              })}
            </div>

            <div className="wordle-notification-row" role="status" aria-live="polite" aria-atomic="true">
              {challengeNotification(game, challenge, activeChallengeProgress, app.household.members)}
            </div>

            {!game.complete && (
              <>
                {guessError && <p className="wordle-guess-error" role="alert">{guessError}</p>}
                <p className="muted small">Guess {game.guesses.length + 1} of {WORDLE_MAX_GUESSES}</p>
              </>
            )}

            {!game.complete && (
              <div className="wordle-keyboard" role="group" aria-label="Wordle keyboard">
                {['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((row, rowIndex) => (
                  <div className="wordle-key-row" key={row}>
                    {rowIndex === 2 && (
                      <button
                        type="button"
                        className="wordle-key wordle-key-action"
                        onClick={() => void submitGuess()}
                        disabled={submitting || ending || !validWord(guess, game.length)}
                      >
                        Enter
                      </button>
                    )}
                    {row.split('').map((letter) => {
                      const mark = keyboardMarks.get(letter)
                      const markLabel = mark ? `, ${mark}` : ''
                      return (
                        <button
                          type="button"
                          className={`wordle-key${mark ? ` ${mark}` : ''}`}
                          key={letter}
                          onClick={() => addLetter(letter)}
                          disabled={submitting || ending || guess.length >= game.length}
                          aria-label={`${letter}${markLabel}`}
                          title={mark ? `${letter}: ${mark}` : letter}
                        >
                          {letter}
                        </button>
                      )
                    })}
                    {rowIndex === 2 && (
                      <button
                        type="button"
                        className="wordle-key wordle-key-action"
                        onClick={removeLetter}
                        disabled={submitting || ending || !guess}
                        aria-label="Delete last letter"
                        title="Delete last letter"
                      >
                        ⌫
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!game.complete && (
              <button type="button" className="secondary small" onClick={() => void giveUp()} disabled={submitting || ending}>
                {ending ? 'Ending game…' : 'Give up'}
              </button>
            )}

            {!challenge && (
              <button type="button" className="secondary small" onClick={quitDailyGame}>
                Quit
              </button>
            )}

            {game.complete && (
              <p className="wordle-result" role="status">
                {game.abandoned
                  ? `You gave up after ${game.guesses.length} ${game.guesses.length === 1 ? 'guess' : 'guesses'}.`
                  : game.solved
                    ? `Solved in ${game.guesses.length} ${game.guesses.length === 1 ? 'guess' : 'guesses'}!`
                    : 'Out of guesses.'}
                {' '}The word was <strong>{game.answer}</strong>.
                {game.solved && ` Time: ${seconds(game.elapsedMs)}.`}
                {challenge
                  && !wordleChallengeFinished(challenge.players ?? [challenge.to], activeChallengeProgress)
                  && ' Other players can keep going.'}
              </p>
            )}
          </article>

        </>
      )}

      {!challenge && !game && <article className="card game-leaderboard">
        <h3>Family leaderboard</h3>
        <p className="muted small">Solved puzzles · fewest guesses, then fastest time</p>
        {scoreError && <p className="error small">{scoreError}</p>}
        {!scores.length ? <p className="muted small">Solve the word to set the first family score.</p> : (
          <ol>
            {scores.map((score) => (
              <li key={score.uid} className={score.uid === app.uid ? 'game-score-me' : ''}>
                <strong>{app.household.members[score.uid]?.displayName ?? 'Family member'}</strong>
                <span>
                  {formatGameResult('wordle', score.best)}
                  <small className="wordle-mode">
                    {score.best.hardMode === true ? 'Hard mode' : 'Mode unknown'}
                  </small>
                </span>
              </li>
            ))}
          </ol>
        )}
      </article>}
    </section>
  )
}
