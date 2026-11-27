import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  createWordleChallenge,
  abandonDailyWordle,
  abandonWordleChallenge,
  cancelWordleChallenge,
  getDailyWordlePreview,
  getDailyWordle,
  getWordleChallenge,
  readyWordleChallenge,
  guessDailyWordle,
  guessWordleChallenge,
  type DailyWordlePreview,
  type WordleGameState,
  type WordleChallengeType,
} from '../../firebase/wordle'
import { announceDailyWordle, useGameScores, useWordleChallengeProgress, type GameChallenge } from '../../firebase/games'
import { useApp } from '../../hooks/useApp'
import { challengeMessage, hardModeError, normalizeWord, wordleDay, validWord, wordleChallengeFinished, wordleKeyboardMarks, WORDLE_MAX_LENGTH, WORDLE_MIN_LENGTH, WORDLE_MAX_GUESSES } from '../../games/wordle'
import { celebrate } from '../../utils/celebrate'
import { Icon } from '../UI/Icon'
import { WordleProgressBoard } from './WordleProgressBoard'
import { WordleDailyResults } from './WordleDailyResults'
import { earnDaily } from '../../firebase/play'
import { sendToInbox } from '../../firebase/inbox'
import { today } from '../../engine/dates'
import { challengeNotification } from './wordleNotification'

const seconds = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

/** day: play the daily Wordle of that date (one from the last week, opened from someone's result) instead of today's. */
export function WordleGame({ challenge, day, daily = false, onBack }: { challenge?: GameChallenge; day?: string; /** Playing through the daily games: no Challenge someone. */ daily?: boolean; onBack: () => void }) {
  const app = useApp()
  const [game, setGame] = useState<WordleGameState | null>(null)
  // How many people were told when you finished today's Wordle (0: not this time).
  const [announced, setAnnounced] = useState(0)
  const [dailyPreview, setDailyPreview] = useState<DailyWordlePreview | null>(null)
  const [receivedAt, setReceivedAt] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [lobbyNow, setLobbyNow] = useState(0)
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
  const { scores, error: scoreError } = useGameScores('wordle', scoreSeed, !challenge && !!scoreSeed && app.canPlay)
  const { progress: challengeProgress, error: challengeProgressError, loaded: challengeProgressLoaded } = useWordleChallengeProgress(app.uid, app.canPlay && !!challenge)
  const celebratedProgress = useRef(new Set<string>())
  const progressInitialized = useRef(false)
  const lobbyRefreshAt = useRef(0)
  const realtimeTransitionLoading = useRef(false)
  const people = Object.entries(app.household.members)
    .filter(([id, member]) => id !== app.uid && (member.role === 'member' || member.role === 'viewer') && !member.bot)
    .sort((a, b) => a[1].displayName.localeCompare(b[1].displayName))
  const isRandomChallenge = challengeType === 'random-live' || challengeType === 'realtime-live'
  const challengePlayers = isRandomChallenge
    ? Object.entries(app.household.members)
      .filter(([, member]) => (member.role === 'member' || member.role === 'viewer') && !member.bot)
      .sort((a, b) => a[1].displayName.localeCompare(b[1].displayName))
    : people
  const canSendChallenge = selected.length >= (isRandomChallenge ? 2 : 1)
    && (!isRandomChallenge || selected.includes(app.uid))
    && (isRandomChallenge || validWord(word))
    && !inviting
  const keyboardMarks = useMemo(() => wordleKeyboardMarks(game?.guesses ?? []), [game])

  const challengeId = challenge?.id
  // Playing an earlier day's puzzle (from someone's result).
  const earlier = !challenge && !!day && day !== today()
  const isRealtimeChallenge = challenge?.challengeType === 'realtime-live'
  const waitingForPlayers = isRealtimeChallenge && game?.challengeStatus === 'waiting'
  const realtimeEnded = isRealtimeChallenge && (game?.challengeStatus === 'cancelled' || game?.challengeStatus === 'expired')
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
  // The news under the board (hard mode, other players finishing, how a finished game went).
  const notice = game ? challengeNotification(game, challenge, activeChallengeProgress, app.household.members) : null

  useEffect(() => {
    if (!waitingForPlayers || !challengeId || realtimeTransitionLoading.current) return
    if (!activeChallengeProgress.some((player) =>
      player.lobbyStatus === 'playing' || player.lobbyStatus === 'cancelled' || player.lobbyStatus === 'expired',
    )) return
    realtimeTransitionLoading.current = true
    void getWordleChallenge(challengeId)
      .then((state) => {
        setGame(state)
        setElapsed(state.elapsedMs)
        setReceivedAt(Date.now())
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => { realtimeTransitionLoading.current = false })
  }, [waitingForPlayers, challengeId, activeChallengeProgress])

  useEffect(() => {
    let cancelled = false
    async function loadDailyPreview() {
      try {
        const preview = await getDailyWordlePreview(day)
        if (!cancelled) {
          setDailyPreview((current) => current?.complete && !preview.complete ? current : preview)
        }
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
        setLobbyNow(Date.now())
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
  }, [challengeId, day])

  useEffect(() => {
    if (!game || game.complete || game.challengeStatus === 'waiting') return
    const timer = window.setInterval(() => setElapsed(game.elapsedMs + Date.now() - receivedAt), 1000)
    return () => window.clearInterval(timer)
  }, [game, receivedAt])

  useEffect(() => {
    if (!waitingForPlayers || !game?.lobbyExpiresAt || !challengeId) return
    const expiresAt = Date.parse(game.lobbyExpiresAt)
    const timer = window.setInterval(() => {
      const now = Date.now()
      setLobbyNow(now)
      if (now < expiresAt || now - lobbyRefreshAt.current < 5000) return
      lobbyRefreshAt.current = now
      void getWordleChallenge(challengeId)
        .then((state) => {
          setGame(state)
          setElapsed(state.elapsedMs)
          setReceivedAt(Date.now())
          setError(null)
        })
        .catch((err) => setError(err instanceof Error ? err.message : String(err)))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [waitingForPlayers, game?.lobbyExpiresAt, challengeId])

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
      if (game.mode === 'daily') next = await guessDailyWordle(normalized, day)
      else {
        if (!challengeId) throw new Error('This Wordle challenge is unavailable.')
        next = await guessWordleChallenge(challengeId, normalized)
      }
      setGame(next)
      setElapsed(next.elapsedMs)
      setReceivedAt(Date.now())
      setGuess('')
      // Finishing Wordle of the day (solved or not) earns Glider play time, once a day.
      if (next.complete && game.mode === 'daily') {
        void earnDaily(app.uid, 'wordle', today()).catch(() => undefined)
        // Tell the family (score, time, squares, today's ranking), once a day.
        void announceDailyWordle(app.uid, app.household.members, next, today()).then((n) => n && setAnnounced(n), () => undefined)
      }
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
      const state = await getDailyWordle(day)
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
    if (game?.mode === 'daily') {
      setDailyPreview((current) => ({
        date: current?.date ?? game.date ?? '',
        seed: current?.seed ?? game.seed,
        ...current,
        complete: game.complete,
        solved: game.solved,
        abandoned: !!game.abandoned,
        guessCount: game.guesses.length,
      }))
    }
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
        isRandomChallenge ? null : normalizeWord(word),
        selected,
        challengeType,
      )
      // The invitation also lands in each person's Inbox, with a notification within seconds (best effort). Without a
      // challenge id it opens the Games page, whose Invitations list it.
      // It says which kind it is: your own word for them, a play-any-time challenge (chosen or random word), or a race.
      const recipients = selected.filter((id) => id !== app.uid)
      const { title, text } = challengeMessage(challengeType, challengeType === 'invite' ? 0 : recipients.length - 1)
      // Each person's invitation opens their own copy of the challenge (each player has one).
      for (const to of recipients) {
        const own = result.challengeIds?.[to]
        void sendToInbox(app.uid, [to], { kind: 'game', title, text, link: own ? `#/games/${own}` : '#/games' }).catch(() => undefined)
      }
      setWord('')
      setSelected([])
      if (isRandomChallenge && result.challengeId) {
        app.navigate({ view: 'games', challengeId: result.challengeId })
      } else {
        setMessage(
          challengeType === 'live-chosen'
            ? `Live challenge started with ${result.invited} ${result.invited === 1 ? 'player' : 'players'}.`
            : challengeType === 'realtime-live'
              ? `Real-time challenge invitations sent to ${result.invited} ${result.invited === 1 ? 'player' : 'players'}.`
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
      if (game.mode === 'daily') next = await abandonDailyWordle(day)
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

  async function markReady() {
    if (!challengeId || !game || !waitingForPlayers || game.ready || ending) return
    setEnding(true)
    setError(null)
    try {
      const state = await readyWordleChallenge(challengeId)
      setGame(state)
      setElapsed(state.elapsedMs)
      setReceivedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnding(false)
    }
  }

  async function cancelLobby() {
    if (!challengeId || !waitingForPlayers || ending) return
    if (!window.confirm('Cancel this real-time Wordle for everyone?')) return
    setEnding(true)
    setError(null)
    try {
      const state = await cancelWordleChallenge(challengeId)
      setGame(state)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnding(false)
    }
  }

  if (!app.canPlay) return <p className="muted">Wordle is for the family.</p>

  return (
    <section className="games-view">
      <header className="view-header">
        <h2><Icon name="sparkle" /> Wordle</h2>
        <span className="muted small">
          {challenge
            ? isRealtimeChallenge
              ? 'Real-time Live Wordle'
              : challenge.from === app.uid ? 'Your live challenge' : `Challenge from ${app.household.members[challenge.from]?.displayName ?? 'a family member'}`
            : 'Today’s word, the same for everyone.'}
        </span>
        <button type="button" className="secondary small" onClick={onBack}>Show All Games</button>
      </header>

      {loading && <p className="muted">Opening Wordle…</p>}
      {error && <p className="error small" role="alert">{error}</p>}
      {challengeProgressError && <p className="error small">{challengeProgressError}</p>}

      {!challenge && !game && (
        <article className="card game-invite-form">
          <div className="row">
            <div className="grow">
              <h3>{earlier ? 'Daily Wordle' : 'Today’s Wordle'}{dailyPreview ? ` · ${wordleDay(dailyPreview.date)}` : ''}</h3>
              {earlier && (
                <p className="small">
                  An earlier day’s Wordle: the same word everyone had that day, so your result ranks with theirs.{' '}
                  <button type="button" className="link small" onClick={() => app.navigate({ view: 'games', gameId: 'wordle' })}>
                    Today’s instead
                  </button>
                </p>
              )}
              <p className="muted small">
                {dailyPreview?.complete
                  ? dailyPreview.solved
                    ? `Solved in ${dailyPreview.guessCount} ${dailyPreview.guessCount === 1 ? 'guess' : 'guesses'}.`
                    : dailyPreview.abandoned
                      ? `You gave up after ${dailyPreview.guessCount} ${dailyPreview.guessCount === 1 ? 'guess' : 'guesses'}.`
                      : 'You used all six guesses.'
                  : 'Five letters · six guesses · hard mode'}
              </p>
            </div>
            <button type="button" className="small" onClick={() => void startDailyGame()} disabled={loading}>
              {loading ? 'Opening…' : dailyPreview?.complete ? 'Show my board' : dailyPreview?.guessCount ? 'Keep playing' : 'Play'}
            </button>
          </div>
        </article>
      )}

      {game && (
        <>
          <article className={`game-card card wordle-game wordle-game-playing${challenge ? ' wordle-game-challenge' : ''}`}>
            <header className="row wrap">
              <div className="grow">
                <h3>{game.mode === 'daily' ? `${earlier ? 'Daily Wordle' : 'Today’s Wordle'}${game.date ? ` · ${wordleDay(game.date)}` : ''}` : `${game.length}-letter challenge`}</h3>
                <p className="muted small">
                  {game.length} letters · six guesses
                  {game.length === 5 ? ' · hard mode (use every revealed hint)' : ''}
                  {' · '}fewest guesses, then fastest time
                </p>
              </div>
              <div className="wordle-clock" aria-label={waitingForPlayers ? 'Lobby time remaining' : 'Elapsed time'}>
                {waitingForPlayers && game.lobbyExpiresAt
                  ? seconds(Math.max(0, Date.parse(game.lobbyExpiresAt) - lobbyNow))
                  : seconds(elapsed)}
              </div>
            </header>

            {waitingForPlayers ? (
              <div className="wordle-ready-lobby">
                <h4>Waiting for everyone to be ready</h4>
                <p className="muted small">
                  The shared timer and game start when every player is ready. The lobby expires after 15 minutes.
                </p>
                <WordleProgressBoard
                  participants={challenge?.players ?? [challenge?.to ?? app.uid]}
                  progress={activeChallengeProgress}
                  members={app.household.members}
                />
                <div className="row wrap">
                  <button type="button" onClick={() => void markReady()} disabled={game.ready || ending}>
                    {ending ? 'Updating…' : game.ready ? 'You’re ready' : 'I’m ready'}
                  </button>
                  <button type="button" className="secondary small" onClick={() => void cancelLobby()} disabled={ending}>
                    Cancel challenge
                  </button>
                </div>
              </div>
            ) : realtimeEnded ? (
              <div className="wordle-ready-lobby">
                <p className="wordle-result" role="status">
                  {game.challengeStatus === 'expired'
                    ? 'The lobby expired because not everyone was ready within 15 minutes.'
                    : 'This real-time challenge was cancelled for everyone.'}
                </p>
                <WordleProgressBoard
                  participants={challenge?.players ?? [challenge?.to ?? app.uid]}
                  progress={activeChallengeProgress}
                  members={app.household.members}
                />
                <button type="button" className="secondary small" onClick={onBack}>Return to games</button>
              </div>
            ) : (
            <>
            {!game.complete && (
              <div className="wordle-game-actions">
                <button type="button" className="secondary small" onClick={() => void giveUp()} disabled={submitting || ending}>
                  {ending ? 'Ending game…' : 'Give up'}
                </button>
                {!challenge && (
                  <button type="button" className="secondary small" onClick={quitDailyGame} disabled={submitting || ending}>
                    Quit
                  </button>
                )}
              </div>
            )}
            {challenge?.payload?.puzzleId
              && challenge.challengeType !== 'invite'
              && !game.complete
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

            {/* One line under the board, to keep the keyboard close: while playing, the guess count with any news (hard
                mode, other players finishing), or what was wrong with a guess; at the end, how it went. */}
            {game.complete ? (
              <div className="wordle-notification-row" role="status" aria-live="polite" aria-atomic="true">
                {notice}
              </div>
            ) : guessError ? (
              <p className="wordle-guess-error" role="alert">
                {guessError}
              </p>
            ) : (
              <p className="muted small wordle-guess-count" role="status" aria-live="polite" aria-atomic="true">
                Guess {game.guesses.length + 1} of {WORDLE_MAX_GUESSES}
                {notice ? ` · ${notice}` : ''}
              </p>
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

            {!challenge && game.complete && (
              <button type="button" className="secondary small" onClick={quitDailyGame}>
                Return to Wordle
              </button>
            )}

            {game.complete && (
              <>
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
                {challenge?.challengeType !== 'invite' && challenge?.payload?.puzzleId && (
                  <div className="wordle-challenge-summary">
                    <strong>Challenge player results</strong>
                    <WordleProgressBoard
                      participants={(challenge.players ?? [challenge.to]).filter((uid) => uid !== app.uid)}
                      progress={activeChallengeProgress}
                      members={app.household.members}
                    />
                  </div>
                )}
                {challenge && (
                  <button type="button" className="secondary small" onClick={onBack}>
                    Return to games
                  </button>
                )}
                {!challenge && game.mode === 'daily' && announced > 0 && (
                  <p className="small sent-note">
                    <Icon name="send" /> Everyone was told your score, with Play to try today’s word.
                  </p>
                )}
              </>
            )}
            </>
            )}
          </article>

        </>
      )}



      {/* Challenge someone: on the Wordle page, not while you're playing, nor in the daily games. */}
      {!challenge && !game && !daily && (
        <article className="card game-invite-form">
          <div className="row">
            <div className="grow">
              <h3>Challenge someone</h3>
              <p className="muted small">Your own word for them, a play-any-time challenge, or a real-time race.</p>
            </div>
            <button type="button" className="secondary small" aria-expanded={showCreate} onClick={() => setShowCreate((open) => !open)}>
              {showCreate ? 'Hide' : 'Set one up'}
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
                <label className="wordle-challenge-option">
                  <input
                    type="radio"
                    name="wordle-challenge-type"
                    checked={challengeType === 'realtime-live'}
                    onChange={() => setChallengeType('realtime-live')}
                  />
                  <span>
                    <strong>Real-time Live Wordle</strong>
                    <span className="muted small">Everyone marks Ready before the shared timer and game begin. The lobby cancels after 15 minutes if everyone has not joined.</span>
                  </span>
                </label>
              </fieldset>
              {!isRandomChallenge && (
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
              <p className="muted small">{isRandomChallenge ? 'Players (include yourself)' : 'Invite family members'}</p>
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
                  : challengeType === 'realtime-live'
                    ? `Start real-time challenge${selected.length ? ` with ${selected.filter((id) => id !== app.uid).length}` : ''}`
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
      {/* The family's day: before you play, and under your board once you've finished. */}
      {!challenge && (!game || (game.mode === 'daily' && game.complete)) && (game?.date ?? dailyPreview?.date) && (
        <WordleDailyResults date={(game?.date ?? dailyPreview?.date)!} today={today()} scores={scores} finished={!!(game?.complete ?? dailyPreview?.complete)} />
      )}
      {scoreError && <p className="error small">{scoreError}</p>}
    </section>
  )
}
