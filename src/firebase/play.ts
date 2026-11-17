// Play time (DESIGN.md §5.16): Glider is played with time you earn by learning (a finished flashcard round, an
// element you open for the first time). play/{uid}: { seconds, seen (element numbers already counted), best, updatedAt };
// only you read or change yours, and the rules cap the balance.
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from './config'
import { EARN, MAX_PLAY_SECONDS } from '../utils/play'

export { EARN, MAX_PLAY_SECONDS, MIN_ROUND, playClock, roundEarns } from '../utils/play'


export interface Play {
  seconds: number
  seen: number[]
  best: number
}

const ref = (uid: string) => doc(db, 'play', uid)

/** Your play time, live. */
export function usePlay(uid: string, enabled = true): Play | null {
  const [play, setPlay] = useState<{ uid: string; play: Play } | null>(null)
  useEffect(() => {
    if (!enabled) return
    return onSnapshot(
      ref(uid),
      (d) => {
        const data = (d.data() ?? {}) as Partial<Play>
        setPlay({ uid, play: { seconds: data.seconds ?? 0, seen: data.seen ?? [], best: data.best ?? 0 } })
      },
      () => setPlay({ uid, play: { seconds: 0, seen: [], best: 0 } }),
    )
  }, [uid, enabled])
  return play?.uid === uid ? play.play : null
}

/** Change it in one step (read, adjust, write), so two devices can't lose each other's changes. */
function change(uid: string, adjust: (p: Play) => Partial<Play> | null): Promise<Play | null> {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref(uid))
    const data = (snap.data() ?? {}) as Partial<Play>
    const now: Play = { seconds: data.seconds ?? 0, seen: data.seen ?? [], best: data.best ?? 0 }
    const patch = adjust(now)
    if (!patch) return null
    const next = { ...now, ...patch }
    next.seconds = Math.max(0, Math.min(MAX_PLAY_SECONDS, Math.round(next.seconds)))
    tx.set(ref(uid), { ...next, updatedAt: serverTimestamp() })
    return next
  })
}

/** Earned time (capped); returns how much was actually added. */
export async function earnPlay(uid: string, seconds: number): Promise<number> {
  let added = 0
  await change(uid, (p) => {
    added = Math.max(0, Math.min(seconds, MAX_PLAY_SECONDS - p.seconds))
    return added ? { seconds: p.seconds + added } : null
  })
  return added
}

/** Time used flying; and a new best score, if it is one. */
export const spendPlay = (uid: string, used: number, score = 0) =>
  change(uid, (p) => (used > 0 || score > p.best ? { seconds: p.seconds - used, best: Math.max(p.best, score) } : null))

/** An element opened for the first time earns time (once per element, ever). Returns the seconds earned (0 if seen). */
export async function seeElement(uid: string, number: number): Promise<number> {
  let added = 0
  await change(uid, (p) => {
    if (p.seen.includes(number)) return null
    added = Math.min(EARN.element, MAX_PLAY_SECONDS - p.seconds)
    return { seen: [...p.seen, number].slice(-118), seconds: p.seconds + added }
  })
  return added
}

