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
  challengeStatus?: 'pending' | 'waiting' | 'playing' | 'completed' | 'declined' | 'abandoned' | 'cancelled' | 'expired'
  ready?: boolean
  lobbyExpiresAt?: string
}

export interface DailyWordlePreview {
  date: string
  seed: string
  complete: boolean
  solved: boolean
  abandoned: boolean
  guessCount: number
}

export type WordleChallengeType = 'invite' | 'live-chosen' | 'random-live' | 'realtime-live'

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

// The daily Wordle: today's, or (day: "2026-11-19") one from the last week, so a result someone shared yesterday
// plays the same word.
const onDay = (day?: string) => (day ? { date: day } : {})

export const getDailyWordlePreview = (day?: string) => wordleRequest<DailyWordlePreview>('daily_preview', onDay(day))

export const getDailyWordle = (day?: string) => wordleRequest<WordleGameState>('daily_status', onDay(day))

export const guessDailyWordle = (guess: string, day?: string) =>
  wordleRequest<WordleGameState>('daily_guess', { guess, ...onDay(day) })

export const abandonDailyWordle = (day?: string) => wordleRequest<WordleGameState>('daily_abandon', onDay(day))

export const getWordleChallenge = (challengeId: string) =>
  wordleRequest<WordleGameState>('challenge_status', { challengeId })

export const guessWordleChallenge = (challengeId: string, guess: string) =>
  wordleRequest<WordleGameState>('challenge_guess', { challengeId, guess })

export const declineWordleChallenge = (challengeId: string) =>
  wordleRequest<{ challengeStatus: 'declined' | 'cancelled' }>('challenge_decline', { challengeId })

export const readyWordleChallenge = (challengeId: string) =>
  wordleRequest<WordleGameState>('challenge_ready', { challengeId })

export const cancelWordleChallenge = (challengeId: string) =>
  wordleRequest<WordleGameState>('challenge_cancel', { challengeId })

export const abandonWordleChallenge = (challengeId: string) =>
  wordleRequest<WordleGameState>('challenge_abandon', { challengeId })

export const createWordleChallenge = (word: string | null, recipients: string[], challengeType: WordleChallengeType) =>
  wordleRequest<{ invited: number; participants: number; challengeId?: string }>(
    'custom_create',
    { ...(word ? { word } : {}), recipients, challengeType },
  )
