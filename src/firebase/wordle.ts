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
  abandoned?: boolean
  answer?: string
  challengeStatus?: 'pending' | 'completed' | 'abandoned'
}

export type WordleChallengeType = 'invite' | 'live-chosen' | 'random-live'

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
  if (typeof result.error === 'string') throw new Error(result.error)
  if (!response.ok) throw new Error(`Wordle service returned ${response.status}.`)
  return result
}

export const getDailyWordle = () => wordleRequest<WordleGameState>('daily_status')

export const guessDailyWordle = (guess: string) =>
  wordleRequest<WordleGameState>('daily_guess', { guess })

export const abandonDailyWordle = () => wordleRequest<WordleGameState>('daily_abandon')

export const getWordleChallenge = (challengeId: string) =>
  wordleRequest<WordleGameState>('challenge_status', { challengeId })

export const guessWordleChallenge = (challengeId: string, guess: string) =>
  wordleRequest<WordleGameState>('challenge_guess', { challengeId, guess })

export const declineWordleChallenge = (challengeId: string) =>
  wordleRequest<{ challengeStatus: 'declined' }>('challenge_decline', { challengeId })

export const abandonWordleChallenge = (challengeId: string) =>
  wordleRequest<WordleGameState>('challenge_abandon', { challengeId })

export const createWordleChallenge = (word: string | null, recipients: string[], challengeType: WordleChallengeType) =>
  wordleRequest<{ invited: number; participants: number; challengeId?: string }>(
    'custom_create',
    { ...(word ? { word } : {}), recipients, challengeType },
  )
