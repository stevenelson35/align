// Gift lists' data: the secret companion list (made when the first surprise idea is added) and claims. Claims are
// queried by recipient, never for lists meant for you (the rules would refuse, and the point is not to know).
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import type { GiftClaim, Household, List } from '../types'
import { recipientKey, secretListFor, secretSharedWith } from '../utils/gifts'
import { db } from './config'
import { createList } from './db'

/** Live claims on gifts for these recipients (recipient keys; yours must not be among them). */
export function useGiftClaims(recipients: string[]): { claims: GiftClaim[]; error: string | null } {
  const [byKey, setByKey] = useState<Record<string, GiftClaim[]>>({})
  const [error, setError] = useState<string | null>(null)
  const key = [...new Set(recipients)].sort().join('|')
  useEffect(() => {
    if (!key) return
    const unsubs = key.split('|').map((r) =>
      onSnapshot(
        query(collection(db, 'giftClaims'), where('recipientId', '==', r)),
        (snap) => setByKey((prev) => ({ ...prev, [r]: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GiftClaim, 'id'>) })) })),
        (err) => setError(err.message),
      ),
    )
    return () => unsubs.forEach((u) => u())
  }, [key])
  const wanted = new Set(key.split('|'))
  return { claims: Object.entries(byKey).flatMap(([r, list]) => (wanted.has(r) ? list : [])), error }
}

/** Claim some of a gift (or change how many / the note / bought). One claim per person per item. */
export function saveClaim(list: List, item: { id: string; title: string }, uid: string, patch: { qty: number; bought: boolean; note?: string }) {
  return setDoc(doc(db, 'giftClaims', `${item.id}_${uid}`), {
    listId: list.id,
    itemId: item.id,
    recipientId: recipientKey(list),
    claimedBy: uid,
    title: item.title.slice(0, 500),
    qty: Math.min(99, Math.max(1, Math.round(patch.qty))),
    bought: patch.bought,
    ...(patch.note?.trim() ? { note: patch.note.trim().slice(0, 500) } : {}),
    updatedAt: serverTimestamp(),
  })
}

export const removeClaim = (itemId: string, uid: string) => deleteDoc(doc(db, 'giftClaims', `${itemId}_${uid}`))

/** The secret companion of a member's gift list: found among your lists, or made (shared with everyone but them). */
export async function ensureSecretList(list: List, lists: List[], household: Household, uid: string): Promise<List> {
  const found = secretListFor(list, lists)
  if (found) return found
  const recipientId = list.recipientId!
  const data = {
    name: `${list.name} (secret ideas)`,
    kind: 'gifts' as const,
    recipientId,
    giftSecret: true,
    secretOf: list.id,
    visibility: 'shared' as const,
    sharedWith: secretSharedWith(household, recipientId, uid),
    ownerId: uid,
    viewerVisible: false,
    defaultContext: 'family' as const,
  }
  const id = await createList(data)
  return { id, ...data }
}
