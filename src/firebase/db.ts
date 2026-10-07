import {
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type FirestoreError,
  type Query,
} from 'firebase/firestore'
import type { Move } from '../engine/scheduling'
import type { Board, BoardItem, Household, ItemStatus, List, Role, Task, Vote } from '../types'
import { db } from './config'

export const householdRef = doc(db, 'household', 'main')

export function subscribeHousehold(
  onData: (household: Household | null) => void,
  onError: (error: FirestoreError) => void,
) {
  // Skip unconfirmed local writes: right after first-time setup, other queries must not start until the
  // server has the household, or the rules (which read it) deny them and those listeners die.
  return onSnapshot(
    householdRef,
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.metadata.hasPendingWrites) return
      onData(snap.exists() ? (snap.data() as Household) : null)
    },
    onError,
  )
}

/** One-time setup when household/main doesn't exist yet; the rules require the creator to be a member. */
export function createHousehold(household: Omit<Household, 'tokenStartDate'>) {
  return setDoc(householdRef, { ...household, tokenStartDate: Timestamp.now() })
}

// ---- Subscriptions ----

/** Listen to several queries and report their union once all have loaded. */
function subscribeUnion<T>(
  queries: Query<DocumentData>[],
  convert: (id: string, data: DocumentData, path: string) => T,
  onData: (items: T[]) => void,
  onError: (error: FirestoreError) => void,
) {
  const parts = queries.map(() => new Map<string, T>())
  const ready = queries.map(() => false)
  const unsubs = queries.map((q, i) =>
    onSnapshot(
      q,
      (snap) => {
        parts[i] = new Map(snap.docs.map((d) => [d.ref.path, convert(d.id, d.data(), d.ref.path)]))
        ready[i] = true
        if (ready.every(Boolean)) onData(parts.flatMap((p) => [...p.values()]))
      },
      onError,
    ),
  )
  return () => unsubs.forEach((u) => u())
}

/** Queries must match the rules (DESIGN.md §11): own private docs, family docs, or viewer-visible family docs. */
function visibleQueries(name: 'lists' | 'tasks', uid: string, role: Role) {
  const c = collection(db, name)
  return role === 'member'
    ? [query(c, where('ownerId', '==', uid), where('visibility', '==', 'private')), query(c, where('visibility', '==', 'family'))]
    : [query(c, where('visibility', '==', 'family'), where('viewerVisible', '==', true))]
}

type OnError = (e: FirestoreError) => void

export function subscribeLists(uid: string, role: Role, onData: (lists: List[]) => void, onError: OnError) {
  return subscribeUnion(visibleQueries('lists', uid, role), (id, d) => ({ ...d, id }) as List, onData, onError)
}

export function subscribeTasks(uid: string, role: Role, onData: (tasks: Task[]) => void, onError: OnError) {
  return subscribeUnion(visibleQueries('tasks', uid, role), (id, d) => ({ ...d, id }) as Task, onData, onError)
}

export function subscribeBoards(role: Role, onData: (boards: Board[]) => void, onError: OnError) {
  const c = collection(db, 'boards')
  const q = role === 'member' ? query(c) : query(c, where('viewerVisible', '==', true))
  return subscribeUnion([q], (id, d) => ({ ...d, id }) as Board, onData, onError)
}

export function subscribeItems(boardId: string, onData: (items: BoardItem[]) => void, onError: OnError) {
  const q = query(collection(db, 'boards', boardId, 'items'))
  return subscribeUnion([q], (id, d) => ({ ...d, id, boardId }) as BoardItem, onData, onError)
}

function voteFromPath(data: DocumentData, path: string): Vote {
  // boards/{boardId}/items/{itemId}/votes/{uid}
  const [, boardId, , itemId] = path.split('/')
  return { boardId, itemId, uid: data.uid, tokens: data.tokens }
}

/** Every member's votes on one item (readable by members and, for visible boards, viewers). */
export function subscribeItemVotes(boardId: string, itemId: string, onData: (votes: Vote[]) => void, onError: OnError) {
  const q = query(collection(db, 'boards', boardId, 'items', itemId, 'votes'))
  return subscribeUnion([q], (_, d, path) => voteFromPath(d, path), onData, onError)
}

/** My votes across all boards, for the token balance (collection-group index on votes.uid). */
export function subscribeMyVotes(uid: string, onData: (votes: Vote[]) => void, onError: OnError) {
  const q = query(collectionGroup(db, 'votes'), where('uid', '==', uid))
  return subscribeUnion([q], (_, d, path) => voteFromPath(d, path), onData, onError)
}

// ---- Lists ----

export type ListInput = Omit<List, 'id'>

export async function createList(list: ListInput) {
  const ref = doc(collection(db, 'lists'))
  await setDoc(ref, { ...list, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return ref.id
}

/** Tasks carry copies of visibility/ownerId/viewerVisible, so they're updated in the same batch (DESIGN.md §5.3). */
export function updateList(list: List, patch: Partial<ListInput>, tasks: Task[]) {
  const next = { ...list, ...patch }
  if (next.visibility === 'private') next.viewerVisible = false
  const { id, ...data } = next
  const batch = writeBatch(db)
  batch.update(doc(db, 'lists', id), { ...data, updatedAt: serverTimestamp() })
  const copiedChanged =
    next.visibility !== list.visibility || next.ownerId !== list.ownerId || next.viewerVisible !== list.viewerVisible
  if (copiedChanged) {
    for (const t of tasks.filter((t) => t.listId === id)) {
      batch.update(doc(db, 'tasks', t.id), {
        visibility: next.visibility,
        ownerId: next.ownerId,
        viewerVisible: next.viewerVisible,
        updatedAt: serverTimestamp(),
      })
    }
  }
  return batch.commit()
}

export function deleteList(listId: string, tasks: Task[]) {
  const batch = writeBatch(db)
  for (const t of tasks.filter((t) => t.listId === listId)) batch.delete(doc(db, 'tasks', t.id))
  batch.delete(doc(db, 'lists', listId))
  return batch.commit()
}

// ---- Tasks ----

export type TaskInput = Omit<Task, 'id' | 'listId' | 'visibility' | 'ownerId' | 'viewerVisible' | 'createdBy'>

export async function createTask(list: List, input: TaskInput, uid: string) {
  const ref = doc(collection(db, 'tasks'))
  await setDoc(ref, {
    ...input,
    listId: list.id,
    visibility: list.visibility,
    ownerId: list.ownerId,
    viewerVisible: list.viewerVisible,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/** Patch a task. Undefined values clear the field. Moving to another list re-copies that list's fields. */
export function updateTask(id: string, patch: Partial<TaskInput>, moveTo?: List) {
  const data: Record<string, unknown> = { updatedAt: serverTimestamp() }
  for (const [k, v] of Object.entries(patch)) data[k] = v === undefined ? deleteField() : v
  if (moveTo) {
    Object.assign(data, {
      listId: moveTo.id,
      visibility: moveTo.visibility,
      ownerId: moveTo.ownerId,
      viewerVisible: moveTo.viewerVisible,
    })
  }
  return updateDoc(doc(db, 'tasks', id), data)
}

export function deleteTask(id: string) {
  return deleteDoc(doc(db, 'tasks', id))
}

/** Apply a shift preview plus refreshed conflict flags as one batch (DESIGN.md §6.3). */
export function applySchedule(moves: Move[], conflicts: Map<string, string | undefined>) {
  const batch = writeBatch(db)
  const ids = new Set([...moves.map((m) => m.id), ...conflicts.keys()])
  for (const id of ids) {
    const m = moves.find((x) => x.id === id)
    const data: Record<string, unknown> = { updatedAt: serverTimestamp() }
    if (m) data.startDate = m.to
    if (m?.durationDays) data.durationDays = m.durationDays
    if (conflicts.has(id)) data.conflict = conflicts.get(id) ?? deleteField()
    batch.update(doc(db, 'tasks', id), data)
  }
  return batch.commit()
}

// ---- Voting ----

export const STARTER_BOARDS = ['Movies & Shows', 'Restaurants & Meals', 'Weekend Activities', 'Travel Plans']

export async function createBoard(name: string, viewerVisible = false) {
  const ref = doc(collection(db, 'boards'))
  await setDoc(ref, { name, viewerVisible, createdAt: serverTimestamp() })
  return ref.id
}

export function updateBoard(board: Board, patch: Partial<Omit<Board, 'id'>>) {
  return updateDoc(doc(db, 'boards', board.id), { name: board.name, viewerVisible: board.viewerVisible, ...patch })
}

export async function createItem(boardId: string, title: string, uid: string, category?: string) {
  const ref = doc(collection(db, 'boards', boardId, 'items'))
  await setDoc(ref, { title, category, status: 'open', createdBy: uid, createdAt: serverTimestamp() })
  return ref.id
}

export function setItemStatus(item: BoardItem, status: ItemStatus) {
  return updateDoc(doc(db, 'boards', item.boardId, 'items', item.id), { title: item.title, status })
}

export function setVote(boardId: string, itemId: string, uid: string, tokens: number) {
  const ref = doc(db, 'boards', boardId, 'items', itemId, 'votes', uid)
  return tokens > 0 ? setDoc(ref, { uid, tokens, updatedAt: serverTimestamp() }) : deleteDoc(ref)
}
