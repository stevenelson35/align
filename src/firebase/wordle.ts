import { auth } from './config'
import type { WordleGuess } from '../games/wordle'

export interface WordleGameState {
  mode: 'daily' | 'custom'
  seed: string
  date?: string
  length: number
  guesses: WordleGuess[]
  startedAt: string
  elapsedMs: number
  complete: boolean
  solved: boolean
  answer?: string
  challengeStatus?: 'pending' | 'completed'
}

async function wordleRequest<T>(action: string, values: Record<string, unknown> = {}): Promise<T> {
  const user = auth.currentUser
  if (!user) throw new Error('Sign in to play Wordle.')
  const token = await user.getIdToken()
  const response = await fetch(new URL('/wordle.php', window.location.origin), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...values }),
  })
  const result = await response.json() as { error?: string } & T
  if (!response.ok) throw new Error(result.error ?? `Wordle service returned ${response.status}.`)
  return result
}

export const getDailyWordle = () => wordleRequest<WordleGameState>('daily_status')

export const guessDailyWordle = (guess: string) =>
  wordleRequest<WordleGameState>('daily_guess', { guess })

export const getWordleChallenge = (challengeId: string) =>
  wordleRequest<WordleGameState>('challenge_status', { challengeId })

export const guessWordleChallenge = (challengeId: string, guess: string) =>
  wordleRequest<WordleGameState>('challenge_guess', { challengeId, guess })

export const createWordleChallenge = (word: string, recipients: string[]) =>
  wordleRequest<{ invited: number }>('custom_create', { word, recipients })
