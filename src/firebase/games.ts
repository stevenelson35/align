import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from './config'
import { compareGameResults, type GameId, type GameResult } from '../games/catalog'

export interface GameScore {
  uid: string
  gameId: GameId
  seed: string
  best: GameResult
  plays: number
}

export interface GameChallenge {
  id: string
  gameId: GameId
  from: string
  to: string
  /** Older Lights Out invitations stored their replay seed here. */
  seed?: string
  /** Public, non-secret data needed to replay this challenge. */
  payload?: GameChallengePayload
  participants?: string[]
  players?: string[]
  challengeType?: 'invite' | 'live-chosen' | 'random-live'
  status: 'pending' | 'playing' | 'completed' | 'declined' | 'abandoned'
  dismissed?: boolean
  result?: GameResult & { solved?: boolean; hardMode?: boolean; abandoned?: boolean }
}

export interface WordleChallengeProgress {
  id: string
  groupId: string
  uid: string
  participants: string[]
  length: number
  rows: string[]
  started?: boolean
  complete: boolean
  solved: boolean
  status?: 'declined' | 'abandoned'
  elapsedMs?: number
  updatedAt?: string
}

export interface GameChallengePayload {
  puzzleId?: string
  imageId?: string
  boardSize?: number
  wordLength?: number
  version: number
}

export function useGameScores(gameId: GameId, seed: string, enabled = true) {
  const [scores, setScores] = useState<GameScore[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    const q = query(collection(db, 'gameScores'), where('gameId', '==', gameId), where('seed', '==', seed))
    return onSnapshot(
      q,
      (snap) => {
        setScores(
          snap.docs
            .map((d) => {
              const data = d.data()
              const best = data.best as GameResult | undefined
              return {
                uid: data.uid as string,
                gameId: data.gameId as GameId,
                seed: data.seed as string,
                best: best ?? { moves: data.bestMoves as number, ms: data.bestMs as number },
                plays: data.plays as number,
              }
            })
            .sort((a, b) => compareGameResults(gameId, a.best, b.best))
            .slice(0, 20),
        )
        setError(null)
      },
      (err) => setError(err.message),
    )
  }, [gameId, seed, enabled])
  return { scores, error }
}

export function useGameChallenges(uid: string, enabled = true) {
  const [challenges, setChallenges] = useState<GameChallenge[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!enabled) return
    const q = query(collection(db, 'gameChallenges'), where('to', '==', uid))
    return onSnapshot(
      q,
      (snap) => {
        setChallenges(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GameChallenge))
        setError(null)
        setLoaded(true)
      },
      (err) => {
        setError(err.message)
        setLoaded(true)
      },
    )
  }, [uid, enabled])
  return { challenges, error, loaded: !enabled || loaded }
}

export function usePendingGameChallenges(uid: string, enabled = true) {
  const [challenges, setChallenges] = useState<GameChallenge[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    const q = query(collection(db, 'gameChallenges'), where('to', '==', uid), where('status', '==', 'pending'))
    return onSnapshot(
      q,
      (snap) => {
        setChallenges(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GameChallenge))
        setError(null)
      },
      (err) => setError(err.message),
    )
  }, [uid, enabled])
  return { challenges, error }
}

export function useWordleChallengeUpdates(uid: string, enabled = true) {
  const [challenges, setChallenges] = useState<GameChallenge[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    const q = query(collection(db, 'gameChallenges'), where('participants', 'array-contains', uid))
    return onSnapshot(
      q,
      (snap) => {
        setChallenges(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as GameChallenge)
            .filter((challenge) => challenge.gameId === 'wordle'),
        )
        setError(null)
      },
      (err) => setError(err.message),
    )
  }, [uid, enabled])
  return { challenges, error }
}

export function useWordleChallengeProgress(uid: string, enabled = true) {
  const [progress, setProgress] = useState<WordleChallengeProgress[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loadedUid, setLoadedUid] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    const q = query(collection(db, 'wordleChallengeProgress'), where('participants', 'array-contains', uid))
    return onSnapshot(
      q,
      (snap) => {
        setProgress(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WordleChallengeProgress))
        setError(null)
        setLoadedUid(uid)
      },
      (err) => {
        setError(err.message)
        setLoadedUid(uid)
      },
    )
  }, [uid, enabled])
  return { progress, error, loaded: !enabled || loadedUid === uid }
}

export function useGameChallenge(id: string | undefined) {
  const [state, setState] = useState<{ id: string; challenge: GameChallenge | null; error: string | null } | null>(null)
  useEffect(() => {
    if (!id) return
    return onSnapshot(
      doc(db, 'gameChallenges', id),
      (snap) => {
        setState({ id, challenge: snap.exists() ? ({ id: snap.id, ...snap.data() } as GameChallenge) : null, error: null })
      },
      (err) => setState({ id, challenge: null, error: err.message }),
    )
  }, [id])
  return id ? state?.id === id ? state : { challenge: undefined, error: null } : { challenge: null, error: null }
}

export async function inviteToGame(from: string, recipients: string[], gameId: GameId, payload: GameChallengePayload) {
  const batch = writeBatch(db)
  for (const to of new Set(recipients)) {
    if (to === from) continue
    batch.set(doc(collection(db, 'gameChallenges')), { gameId, from, to, payload, status: 'pending', createdAt: serverTimestamp() })
  }
  await batch.commit()
}

export async function recordGameScore(uid: string, gameId: GameId, seed: string, result: GameResult): Promise<boolean> {
  const ref = doc(db, 'gameScores', `${uid}_${gameId}_${seed}`)
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref)
    const data = snap.exists() ? snap.data() : null
    const oldBest = data
      ? (data.best as GameResult | undefined) ?? { moves: data.bestMoves as number, ms: data.bestMs as number }
      : undefined
    const isBest = !oldBest || compareGameResults(gameId, result, oldBest) < 0
    transaction.set(
      ref,
      {
        uid,
        gameId,
        seed,
        best: isBest ? result : oldBest,
        plays: data ? (data.plays as number) + 1 : 1,
        updatedAt: serverTimestamp(),
      },
    )
    return isBest
  })
}

export function completeGameChallenge(id: string, result: GameResult) {
  return updateDoc(doc(db, 'gameChallenges', id), { status: 'completed', result, completedAt: serverTimestamp() })
}

export function startGameChallenge(id: string) {
  return updateDoc(doc(db, 'gameChallenges', id), { status: 'playing' })
}

export function declineGameChallenge(id: string) {
  return updateDoc(doc(db, 'gameChallenges', id), { status: 'declined', completedAt: serverTimestamp() })
}

export function dismissGameChallenge(id: string) {
  return updateDoc(doc(db, 'gameChallenges', id), { dismissed: true })
}
