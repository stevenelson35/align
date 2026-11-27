// Family challenges (DESIGN.md §5.24): challenges/{id}, readable by everyone invited (the creator too). Each person
// changes only their own entry under players (accepting adds it; check-ins add to its log); the creator changes the
// challenge itself (title, finish icon, who's invited, ending it); leaving takes you off the invited list.
import { arrayUnion, collection, deleteField, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import type { Challenge, ChallengePlayer } from '../utils/challenges'
import { db } from './config'

/** The challenges you're invited to or in, live (active and ended). */
export function useChallenges(uid: string, enabled = true): Challenge[] {
  const [state, setState] = useState<{ uid: string; list: Challenge[] } | null>(null)
  useEffect(() => {
    if (!enabled) return
    return onSnapshot(
      query(collection(db, 'challenges'), where('invited', 'array-contains', uid)),
      (snap) => setState({ uid, list: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Challenge, 'id'>) })) }),
      () => setState({ uid, list: [] }),
    )
  }, [uid, enabled])
  return state?.uid === uid ? state.list : []
}

const clean = (p: ChallengePlayer): ChallengePlayer => ({
  nickname: p.nickname.trim().slice(0, 40) || 'Player',
  icon: p.icon,
  color: p.color,
  start: p.start,
  goal: p.goal,
  ...(p.log?.length ? { log: p.log } : {}),
  ...(p.goalId ? { goalId: p.goalId } : {}),
  joinedAt: p.joinedAt ?? new Date().toISOString(),
})

export async function createChallenge(uid: string, c: { title: string; unit: string; goalIcon: string; invited: string[] }, me: ChallengePlayer): Promise<string> {
  const ref = doc(collection(db, 'challenges'))
  await setDoc(ref, {
    title: c.title.trim().slice(0, 80),
    unit: c.unit.trim().slice(0, 12),
    goalIcon: c.goalIcon,
    createdBy: uid,
    invited: [...new Set([uid, ...c.invited])].slice(0, 20),
    players: { [uid]: clean(me) },
    status: 'active',
    createdAt: new Date().toISOString(),
  })
  return ref.id
}

/** Your own entry: accepting (adds it), or your nickname, icon, color, start, goal and linked goal. */
export const savePlayer = (id: string, uid: string, p: ChallengePlayer) => updateDoc(doc(db, 'challenges', id), { [`players.${uid}`]: clean(p) })

/** A check-in: a new value, now. */
export const checkIn = (id: string, uid: string, v: number) => updateDoc(doc(db, 'challenges', id), { [`players.${uid}.log`]: arrayUnion({ at: new Date().toISOString(), v }) })

/** Take back your last check-in (a typo). */
export const setLog = (id: string, uid: string, log: ChallengePlayer['log']) =>
  updateDoc(doc(db, 'challenges', id), { [`players.${uid}.log`]: log?.length ? log : deleteField() })

/** The creator's changes: title, unit, finish icon, who's invited. */
export const updateChallenge = (id: string, patch: Partial<Pick<Challenge, 'title' | 'unit' | 'goalIcon' | 'invited'>>) => updateDoc(doc(db, 'challenges', id), patch)

/** Ending it keeps it, as history; starting it again is possible. */
export const setChallengeStatus = (id: string, status: Challenge['status']) =>
  updateDoc(doc(db, 'challenges', id), { status, endedAt: status === 'ended' ? new Date().toISOString() : deleteField() })

/** Saying no (or leaving): off the invited list, so it's gone from your Home. */
export const leaveChallenge = (c: Challenge, uid: string) => updateDoc(doc(db, 'challenges', c.id), { invited: c.invited.filter((x) => x !== uid) })
