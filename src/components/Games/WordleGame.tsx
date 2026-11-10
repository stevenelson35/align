import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  createWordleChallenge,
  getDailyWordle,
  getWordleChallenge,
  guessDailyWordle,
  guessWordleChallenge,
  type WordleGameState,
} from '../../firebase/wordle'
import { useGameScores, type GameChallenge } from '../../firebase/games'
import { useApp } from '../../hooks/useApp'
import { compareGameResults, formatGameResult } from '../../games/catalog'
import { normalizeWord, validWord, WORDLE_MAX_LENGTH, WORDLE_MIN_LENGTH, WORDLE_MAX_GUESSES, type LetterMark } from '../../games/wordle'
import { celebrate } from '../../utils/celebrate'
import { Icon } from '../UI/Icon'

const seconds = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

export function WordleGame({ challenge, onBack }: { challenge?: GameChallenge; onBack: () => void }) {
  const app = useApp()
  const [game, setGame] = useState<WordleGameState | null>(null)
  const [receivedAt, setReceivedAt] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [guess, setGuess] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [word, setWord] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [inviting, setInviting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const seed = game?.seed ?? ''
  const { scores, error: scoreError } = useGameScores('wordle', seed, !!game && app.isMember)
  const people = Object.entries(app.household.members)
    .filter(([id, member]) => id !== app.uid && member.role === 'member' && !member.bot)
    .sort((a, b) => a[1].displayName.localeCompare(b[1].displayName))
  const keyboardMarks = useMemo(() => {
    const marks = new Map<string, LetterMark>()
    const rank = { absent: 0, present: 1, correct: 2 }
    for (const row of game?.guesses ?? []) {
      row.word.split('').forEach((letter, index) => {
        const next = row.marks[index]
        if ((rank[next] ?? 0) > (rank[marks.get(letter) ?? 'absent'] ?? 0)) marks.set(letter, next)
      })
    }
    return marks
  }, [game])

  const challengeId = challenge?.id
  useEffect(() => {
    let cancelled = false
    async function loadGame() {
      try {
        const state = challengeId ? await getWordleChallenge(challengeId) : await getDailyWordle()
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
    void loadGame()
    return () => { cancelled = true }
  }, [challengeId])

  useEffect(() => {
    if (!game || game.complete) return
    const timer = window.setInterval(() => setElapsed(game.elapsedMs + Date.now() - receivedAt), 1000)
    return () => window.clearInterval(timer)
  }, [game, receivedAt])

  async function submitGuess() {
    if (!game || game.complete || submitting) return
    const normalized = normalizeWord(guess)
    if (!validWord(normalized, game.length)) {
      setError(`Enter a ${game.length}-letter word.`)
      return
    }
    setSubmitting(true)
    setError(null)
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
        const result = { guesses: next.guesses.length, ms: next.elapsedMs }
        const personalBest = !scores.some((score) => score.uid === app.uid)
          || compareGameResults('wordle', result, scores.find((score) => score.uid === app.uid)!.best) < 0
        if (personalBest) {
          const familyBest = !scores.length || compareGameResults('wordle', result, scores[0].best) < 0
          celebrate({ done: 1, total: 1, message: familyBest ? 'New family Wordle best!' : 'New personal Wordle best!' })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  function onGuessKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  function addLetter(letter: string) {
    if (!game || game.complete || submitting) return
    setGuess((current) => current.length < game.length ? current + letter : current)
  }

  function removeLetter() {
    if (!game || game.complete || submitting) return
    setGuess((current) => current.slice(0, -1))
  }

  async function sendChallenge(event: FormEvent) {
    event.preventDefault()
    if (!validWord(word) || !selected.length || inviting) return
    setInviting(true)
    setError(null)
    setMessage(null)
    try {
      const result = await createWordleChallenge(normalizeWord(word), selected)
      setWord('')
      setSelected([])
      setMessage(`Challenge sent to ${result.invited} ${result.invited === 1 ? 'person' : 'people'}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setInviting(false)
    }
  }

  if (!app.isMember) return <p className="muted">Wordle is for household members.</p>

  return (
    <section className="games-view">
      <header className="view-header">
        <h2><Icon name="sparkle" /> Wordle</h2>
        <span className="muted small">
          {challenge ? `Challenge from ${app.household.members[challenge.from]?.displayName ?? 'a family member'}` : 'A shared daily word, or a word challenge you create.'}
        </span>
        <button type="button" className="secondary small" onClick={onBack}>Show all games</button>
      </header>

      {loading && <p className="muted">Opening Wordle…</p>}
      {error && <p className="error small" role="alert">{error}</p>}

      {!challenge && (
        <article className="card game-invite-form">
          <div className="row">
            <h3 className="grow">Custom word challenge</h3>
            <button type="button" className="secondary small" aria-expanded={showCreate} onClick={() => setShowCreate((open) => !open)}>
              {showCreate ? 'Hide' : 'Create'}
            </button>
          </div>
          {showCreate && (
            <form onSubmit={(event) => void sendChallenge(event)}>
              <p className="muted small">Choose a 2–12 letter word and invite family members. The answer is stored privately and isn’t sent with the invitation.</p>
              <div className="row wrap">
                <label className="small">
                  Your word
                  <input
                    type="password"
                    autoComplete="off"
                    maxLength={WORDLE_MAX_LENGTH}
                    value={word}
                    onChange={(event) => setWord(event.target.value.replace(/[^a-z]/gi, '').slice(0, WORDLE_MAX_LENGTH))}
                    aria-label="Custom Wordle answer"
                  />
                </label>
                <span className="muted small">{WORDLE_MIN_LENGTH}–{WORDLE_MAX_LENGTH} letters</span>
              </div>
              <div className="chips">
                {people.map(([id, member]) => (
                  <label className={`chip-toggle${selected.includes(id) ? ' on' : ''}`} key={id}>
                    <input type="checkbox" checked={selected.includes(id)} onChange={() => setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id])} />
                    {member.displayName}
                  </label>
                ))}
              </div>
              <button type="submit" className="small" disabled={!validWord(word) || !selected.length || inviting}>
                {inviting ? 'Sending…' : `Send challenge${selected.length ? ` to ${selected.length}` : ''}`}
              </button>
              {message && <p className="muted small" role="status">{message}</p>}
            </form>
          )}
        </article>
      )}

      {game && (
        <>
          <article className="game-card card wordle-game">
            <header className="row wrap">
              <div className="grow">
                <h3>{game.mode === 'daily' ? `Daily word · ${game.date}` : `${game.length}-letter challenge`}</h3>
                <p className="muted small">{game.length} letters · six guesses · fewest guesses, then fastest time</p>
              </div>
              <div className="wordle-clock" aria-label="Elapsed time">{seconds(elapsed)}</div>
            </header>

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

            {!game.complete && (
              <form className="wordle-guess-form" onSubmit={(event) => { event.preventDefault(); void submitGuess() }}>
                <label className="small">
                  Guess {game.guesses.length + 1} of {WORDLE_MAX_GUESSES}
                  <input
                    type="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={game.length}
                    value={guess}
                    onChange={(event) => setGuess(event.target.value.replace(/[^a-z]/gi, '').slice(0, game.length).toUpperCase())}
                    onKeyDown={onGuessKeyDown}
                    aria-label={`${game.length}-letter guess`}
                    disabled={submitting}
                  />
                </label>
                <button type="submit" disabled={submitting || !validWord(guess, game.length)}>
                  {submitting ? 'Checking…' : 'Submit guess'}
                </button>
              </form>
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
                        disabled={submitting || !validWord(guess, game.length)}
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
                          disabled={submitting || guess.length >= game.length}
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
                        disabled={submitting || !guess}
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

            {game.complete && (
              <p className="wordle-result" role="status">
                {game.solved ? `Solved in ${game.guesses.length} ${game.guesses.length === 1 ? 'guess' : 'guesses'}!` : 'Out of guesses.'}
                {' '}The word was <strong>{game.answer}</strong>.
                {game.solved && ` Time: ${seconds(game.elapsedMs)}.`}
                {game.challengeStatus === 'completed' && ' Challenge complete.'}
              </p>
            )}
          </article>

          <article className="card game-leaderboard">
            <h3>Family leaderboard</h3>
            <p className="muted small">Solved puzzles · fewest guesses, then fastest time</p>
            {scoreError && <p className="error small">{scoreError}</p>}
            {!scores.length ? <p className="muted small">Solve the word to set the first family score.</p> : (
              <ol>
                {scores.map((score) => (
                  <li key={score.uid} className={score.uid === app.uid ? 'game-score-me' : ''}>
                    <strong>{app.household.members[score.uid]?.displayName ?? 'Family member'}</strong>
                    <span>{formatGameResult('wordle', score.best)}</span>
                  </li>
                ))}
              </ol>
            )}
          </article>
        </>
      )}
    </section>
  )
}
