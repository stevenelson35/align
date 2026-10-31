// Flashcard leaderboards (DESIGN.md §5.9): each set's best Challenge round per person (cardBoards/{listId}, scores
// by uid). Each person writes only their own score. Mastered cards come from the cards' own results (mc).
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from './config'

/** A Challenge round: right of how many, how long it took (ms), and the day. */
export interface ChallengeScore {
  right: number
  of: number
  ms: number
  at: string
}

/** The set's best scores by person, live. */
export function useCardBoard(listId: string, enabled = true): Record<string, ChallengeScore> {
  const [scores, setScores] = useState<{ id: string; scores: Record<string, ChallengeScore> } | null>(null)
  useEffect(() => {
    if (!enabled) return
    return onSnapshot(
      doc(db, 'cardBoards', listId),
      (snap) => setScores({ id: listId, scores: ((snap.data() as { scores?: Record<string, ChallengeScore> } | undefined)?.scores ?? {}) }),
      () => setScores({ id: listId, scores: {} }),
    )
  }, [listId, enabled])
  return scores?.id === listId ? scores.scores : {}
}

/** Saves your score for the set (the caller checks it beats your best). */
export const saveChallengeScore = (listId: string, uid: string, score: ChallengeScore) => setDoc(doc(db, 'cardBoards', listId), { scores: { [uid]: score } }, { merge: true })

/** Whether a round beats a best: more right, or as many right in less time. */
export const beats = (a: ChallengeScore, b: ChallengeScore | undefined) => !b || a.right > b.right || (a.right === b.right && a.ms < b.ms)
