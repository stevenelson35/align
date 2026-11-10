// Goal rewards (DESIGN.md §5.6): everyone's sparks (sparks/{uid}), the picture being uncovered (reveals/current)
// and the reward ladder (rewards/ladder). Members only, by the rules.
import { collection, doc, getDoc, increment, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { cleanLadder, DEFAULT_LADDER, type Reward, type SparkDays } from '../utils/sparks'
import { db } from './config'

export interface Reveal {
  photoId: string
  /** The day it began: sparks from then on are moves. */
  startedAt: string
  startedBy: string
  cols: number
  rows: number
  /** Hits each cell has taken (by cell number, row * cols + col); a cell is clear at `thick`. */
  hits: Record<string, number>
  /** How many hits a cell's ice takes (more people earning sparks, thicker ice: about a week either way). */
  thick: number
  /** Layers of ice broken and moves played, per person. */
  by: Record<string, number>
  spent: Record<string, number>
  /** When the last ice broke. */
  doneAt?: { toMillis(): number }
  /** Photos already revealed (so the next one is new). */
  past?: string[]
}

export const REVEAL_COLS = 8
export const REVEAL_ROWS = 7

const revealRef = () => doc(db, 'reveals', 'current')
const revealPhotoRef = () => doc(db, 'rewards', 'reveal-photo')

/** Everyone's sparks by day, live (one small document per person). */
export function useSparks(enabled = true): Record<string, SparkDays> {
  const [all, setAll] = useState<Record<string, SparkDays>>({})
  useEffect(() => {
    if (!enabled) return
    return onSnapshot(
      collection(db, 'sparks'),
      (snap) => setAll(Object.fromEntries(snap.docs.map((d) => [d.id, ((d.data() as { days?: SparkDays }).days ?? {}) as SparkDays]))),
      () => setAll({}),
    )
  }, [enabled])
  return all
}

/** Saves some of your days' sparks (only the days given change). */
export const saveSparks = (uid: string, days: SparkDays) => setDoc(doc(db, 'sparks', uid), { days }, { merge: true })

/** The current reveal, live; undefined while loading, null if none has started. */
export function useReveal(enabled = true): Reveal | null | undefined {
  const [reveal, setReveal] = useState<Reveal | null | undefined>(undefined)
  useEffect(() => {
    if (!enabled) return
    return onSnapshot(
      revealRef(),
      (snap) => setReveal(snap.exists() ? (snap.data() as Reveal) : null),
      () => setReveal(null),
    )
  }, [enabled])
  return reveal
}

/** The next reveal photo chosen in Settings, or null to pick one at random. */
export function useRevealPhoto(enabled = true): { photoId: string | null | undefined; error: string | null } {
  const [photoId, setPhotoId] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    return onSnapshot(
      revealPhotoRef(),
      (snap) => {
        setPhotoId(snap.exists() ? ((snap.data() as { photoId?: string | null }).photoId ?? null) : null)
        setError(null)
      },
      (err) => {
        setPhotoId(undefined)
        setError(err.message)
      },
    )
  }, [enabled])
  return { photoId, error }
}

export async function getRevealPhoto(): Promise<string | null> {
  const snap = await getDoc(revealPhotoRef())
  return snap.exists() ? ((snap.data() as { photoId?: string | null }).photoId ?? null) : null
}

export const saveRevealPhoto = (uid: string, photoId: string | null) => setDoc(revealPhotoRef(), { photoId, updatedBy: uid })

/** Starts a reveal, consuming a saved photo choice if one was used. */
export function startReveal(
  uid: string,
  photoId: string,
  day: string,
  thick: number,
  previous: Reveal | null | undefined,
  consumePhotoChoice = false,
) {
  const past = [...(previous?.past ?? []), ...(previous ? [previous.photoId] : [])].slice(-300)
  const batch = writeBatch(db)
  batch.set(revealRef(), { photoId, startedAt: day, startedBy: uid, cols: REVEAL_COLS, rows: REVEAL_ROWS, thick, hits: {}, by: {}, spent: {}, past })
  if (consumePhotoChoice) batch.set(revealPhotoRef(), { photoId: null, updatedBy: uid })
  return batch.commit()
}

/** Replaces the active reveal with a photo, keeping the independently selected next photo unchanged. */
export function replaceCurrentReveal(uid: string, photoId: string, day: string) {
  return runTransaction(db, async (transaction) => {
    const revealSnap = await transaction.get(revealRef())
    if (!revealSnap.exists()) throw new Error('There is no active reveal to replace.')

    const current = revealSnap.data() as Reveal
    if (current.photoId === photoId) throw new Error('This photo is already the active reveal.')
    const past = [...(current.past ?? []), current.photoId].slice(-300)
    transaction.set(revealRef(), {
      photoId,
      startedAt: day,
      startedBy: uid,
      cols: REVEAL_COLS,
      rows: REVEAL_ROWS,
      thick: current.thick,
      hits: {},
      by: {},
      spent: {},
      past,
    })
  })
}

/** One move played: its hits are added to each cell's count (two people playing at once never clash). */
export function playMove(uid: string, hits: Record<number, number>, finished: boolean) {
  const layers = Object.values(hits).reduce((a, b) => a + b, 0)
  return updateDoc(revealRef(), {
    ...Object.fromEntries(Object.entries(hits).map(([i, n]) => [`hits.${i}`, increment(n)])),
    [`spent.${uid}`]: increment(1),
    ...(layers ? { [`by.${uid}`]: increment(layers) } : {}),
    ...(finished ? { doneAt: serverTimestamp() } : {}),
  })
}

/** The reward ladder, live (the usual one until someone saves their own). */
export function useLadder(enabled = true): Reward[] {
  const [items, setItems] = useState<Reward[]>(DEFAULT_LADDER)
  useEffect(() => {
    if (!enabled) return
    return onSnapshot(
      doc(db, 'rewards', 'ladder'),
      (snap) => setItems(snap.exists() ? cleanLadder((snap.data() as { items?: Reward[] }).items ?? []) : DEFAULT_LADDER),
      () => setItems(DEFAULT_LADDER),
    )
  }, [enabled])
  return items
}

export const saveLadder = (uid: string, items: Reward[]) => setDoc(doc(db, 'rewards', 'ladder'), { items: cleanLadder(items), updatedBy: uid })
