import {
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  type DocumentData,
  type FirestoreError,
  getDoc,
  increment,
  onSnapshot,
  query,
  type Query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { Move } from '../engine/scheduling'
import type { Board, BoardItem, Comment, Goal, GoalEntry, Household, ItemStatus, List, Role, Task, Vote } from '../types'
import { db } from './config'
import { audienceOf, privacyFields, type Audience } from '../utils/audience'
import { isStoredImage, storedImageId } from '../utils/pictures'
import { today } from '../engine/dates'
import type { DependencyChange } from '../utils/project'

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

/**
 * Queries must match the rules (DESIGN.md §11): own private docs, family docs (viewer-visible ones for viewers),
 * and docs shared with you by name.
 */
function visibleQueries(name: 'lists' | 'tasks' | 'goals', uid: string, role: Role) {
  const c = collection(db, name)
  const shared = query(c, where('sharedWith', 'array-contains', uid))
  return role === 'member'
    ? [query(c, where('ownerId', '==', uid), where('visibility', '==', 'private')), query(c, where('visibility', '==', 'family')), shared]
    : [query(c, where('visibility', '==', 'family'), where('viewerVisible', '==', true)), shared]
}

type OnError = (e: FirestoreError) => void

export function subscribeLists(uid: string, role: Role, onData: (lists: List[]) => void, onError: OnError) {
  return subscribeUnion(visibleQueries('lists', uid, role), (id, d) => ({ ...d, id }) as List, onData, onError)
}

export function subscribeTasks(uid: string, role: Role, onData: (tasks: Task[]) => void, onError: OnError) {
  return subscribeUnion(visibleQueries('tasks', uid, role), (id, d) => ({ ...d, id }) as Task, onData, onError)
}

export function subscribeGoals(uid: string, role: Role, onData: (goals: Goal[]) => void, onError: OnError) {
  return subscribeUnion(visibleQueries('goals', uid, role), (id, d) => ({ ...d, id }) as Goal, onData, onError)
}

// ---- Goals (DESIGN.md §5.6) ----

export type GoalInput = Omit<Goal, 'id' | 'log' | 'createdBy'>

/** Privacy fields as stored: sharedWith only when shared, viewerVisible only for family. */
function goalPrivacy(g: Pick<Goal, 'visibility' | 'sharedWith' | 'ownerId' | 'viewerVisible' | 'audience' | 'editAudience' | 'editors'>) {
  const shared = g.visibility === 'shared'
  const listEdit = g.editAudience === 'parents' || g.editAudience === 'shared'
  return {
    visibility: g.visibility,
    ownerId: g.ownerId,
    viewerVisible: g.visibility === 'family' ? g.viewerVisible : false,
    sharedWith: shared ? (g.sharedWith ?? [g.ownerId]) : deleteField(),
    audience: shared && g.audience === 'parents' ? 'parents' : deleteField(),
    editAudience: g.editAudience ?? 'private',
    editors: listEdit ? [...new Set([g.ownerId, ...(g.editors ?? [])])] : deleteField(),
  }
}

/** For setDoc: the same fields without the "delete this field" markers (nothing to delete in a new doc). */
function withoutDeletes(o: Record<string, unknown>) {
  const sentinel = deleteField()
  return Object.fromEntries(Object.entries(o).filter(([, v]) => !(v && typeof v === 'object' && (v as object).constructor === sentinel.constructor)))
}

/** Undefined optional fields are dropped (ignoreUndefinedProperties), so an emptied field isn't stored. */
export async function createGoal(input: GoalInput, uid: string) {
  const ref = doc(collection(db, 'goals'))
  await setDoc(ref, {
    ...input,
    ...withoutDeletes(goalPrivacy(input)),
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export function updateGoal(goal: Goal, patch: Partial<GoalInput>) {
  const next = { ...goal, ...patch }
  const data: Record<string, unknown> = { updatedAt: serverTimestamp() }
  for (const [k, v] of Object.entries(patch)) data[k] = v === undefined ? deleteField() : v
  return updateDoc(doc(db, 'goals', goal.id), { ...data, ...goalPrivacy(next) })
}

/** Deletes a goal and the pictures stored on its log entries (the ones you added). */
export async function deleteGoal(goal: Pick<Goal, 'id' | 'log'>) {
  await deleteDoc(doc(db, 'goals', goal.id))
  await deleteRemovedImages(Object.values(goal.log ?? {}).flatMap((e) => e.images ?? []), [])
}

/** Running total: add an amount to the day's entry (several people adding on one day all count). */
export function addToTotal(goalId: string, day: string, amount: number, uid: string) {
  return updateDoc(doc(db, 'goals', goalId), { [`log.${day}.value`]: increment(amount), [`log.${day}.by`]: uid, updatedAt: serverTimestamp() })
}

/** Log one day: only that day's fields change, so two people logging a shared goal don't overwrite other days. */
export function logGoal(goalId: string, day: string, entry: GoalEntry, uid: string) {
  const data: Record<string, unknown> = { [`log.${day}.by`]: uid, updatedAt: serverTimestamp() }
  for (const [k, v] of Object.entries(entry)) data[`log.${day}.${k}`] = v === undefined ? deleteField() : v
  return updateDoc(doc(db, 'goals', goalId), data)
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

/** Your own default privacy for new lists and quick adds (Settings). The rules allow only your own entry. */
export function setDefaultVisibility(uid: string, visibility: NonNullable<Household['members'][string]['defaultVisibility']>) {
  return updateDoc(householdRef, { [`members.${uid}.defaultVisibility`]: visibility })
}

/** Your mobile number for "text <name> …" (Settings); empty removes it. */
export function setPhone(uid: string, phone: string) {
  return updateDoc(householdRef, { [`members.${uid}.phone`]: phone.trim() || deleteField() })
}

/** Whether your tasks added without a date are due that day (Settings). */
export function setNewTaskDue(uid: string, due: 'today' | 'none') {
  return updateDoc(householdRef, { [`members.${uid}.newTaskDue`]: due === 'today' ? deleteField() : due })
}

/** Pin a link to (or unpin it from) your own Align menu. */
export function setPinnedLink(uid: string, current: string[] | undefined, linkId: string, pinned: boolean) {
  const next = pinned ? [...new Set([...(current ?? []), linkId])] : (current ?? []).filter((id) => id !== linkId)
  return updateDoc(householdRef, { [`members.${uid}.pinnedLinks`]: next.length ? next : deleteField() })
}

/** Who the "Parents" sharing shortcut picks. */
export function setParents(uids: string[]) {
  return updateDoc(householdRef, { 'groups.parents': uids })
}

/** The fields a task copies from its list, so queries and rules need no lookups (sharedWith only when shared). */
function copiedFields(list: Pick<List, 'visibility' | 'ownerId' | 'viewerVisible' | 'sharedWith' | 'editAudience' | 'editors'>) {
  return {
    visibility: list.visibility,
    ownerId: list.ownerId,
    viewerVisible: list.visibility === 'family' ? list.viewerVisible : false,
    sharedWith: list.visibility === 'shared' ? (list.sharedWith ?? [list.ownerId]) : deleteField(),
    editAudience: list.editAudience ?? deleteField(),
    editors: (list.editAudience === 'parents' || list.editAudience === 'shared') && list.editors ? list.editors : deleteField(),
  }
}

export type ListInput = Omit<List, 'id'>

export async function createList(list: ListInput) {
  const ref = doc(collection(db, 'lists'))
  const { sharedWith, ...rest } = list
  await setDoc(ref, {
    ...rest,
    ...(list.visibility === 'shared' ? { sharedWith: sharedWith ?? [list.ownerId] } : {}),
    viewerVisible: list.visibility === 'family' ? list.viewerVisible : false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * Tasks carry copies of visibility/ownerId/viewerVisible/sharedWith, so they're updated in the same batch
 * (DESIGN.md §5.3).
 */
export function updateList(list: List, patch: Partial<ListInput>, tasks: Task[]) {
  const next = { ...list, ...patch }
  const { id, ...data } = next
  const copied = copiedFields(next)
  const batch = writeBatch(db)
  batch.update(doc(db, 'lists', id), { ...data, ...copied, audience: next.visibility === 'shared' && next.audience === 'parents' ? 'parents' : deleteField(), updatedAt: serverTimestamp() })
  const copiedChanged =
    next.visibility !== list.visibility ||
    next.ownerId !== list.ownerId ||
    copied.viewerVisible !== list.viewerVisible ||
    next.editAudience !== list.editAudience ||
    JSON.stringify(next.editors ?? null) !== JSON.stringify(list.editors ?? null) ||
    JSON.stringify(next.visibility === 'shared' ? next.sharedWith : null) !== JSON.stringify(list.visibility === 'shared' ? list.sharedWith : null)
  if (copiedChanged) {
    for (const t of tasks.filter((t) => t.listId === id)) {
      batch.update(doc(db, 'tasks', t.id), { ...copied, updatedAt: serverTimestamp() })
    }
  }
  return batch.commit()
}

export async function deleteList(listId: string, tasks: Task[]) {
  const batch = writeBatch(db)
  const inList = tasks.filter((t) => t.listId === listId)
  for (const t of inList) batch.delete(doc(db, 'tasks', t.id))
  batch.delete(doc(db, 'lists', listId))
  await batch.commit()
  await deleteRemovedImages(inList.flatMap((t) => t.images ?? []), [])
}

// ---- Tasks ----

export type TaskInput = Omit<Task, 'id' | 'listId' | 'visibility' | 'ownerId' | 'viewerVisible' | 'createdBy' | 'createdAt'>

/**
 * A status change plus `finishedOn`: the day it became done/canceled (`day`, default today), kept if it was already
 * finished, cleared when reopened. Every status change should go through this so day views stay right.
 */
export function withStatus(task: Pick<Task, 'status' | 'finishedOn'>, status: Task['status'], day = today()): Partial<TaskInput> {
  const finished = (s: Task['status']) => s === 'done' || s === 'canceled'
  if (!finished(status)) return { status, finishedOn: undefined }
  return { status, finishedOn: finished(task.status) && task.finishedOn && task.status === status ? task.finishedOn : day }
}

const FAMILY_INBOX = 'Family Inbox'
const PARENTS_INBOX = 'Parents Inbox'
export const READING_LIST = 'Reading list'

/** Your "Reading list" task list (for your default privacy), created the first time it's needed. */
export async function readingListFor(uid: string, defaultAudience: Audience | undefined, editable: List[], parents: string[]): Promise<List> {
  return listForAudience(READING_LIST, READING_LIST, uid, defaultAudience, editable, parents)
}

/**
 * A task list named for an audience (your default visibility): found among the lists you can edit, or created.
 * Only me looks for your own private list; Parents for a Parents list; Family / Everyone for a family list.
 */
async function listForAudience(privateName: string, sharedName: string, uid: string, defaultAudience: Audience | undefined, editable: List[], parents: string[]): Promise<List> {
  const a = defaultAudience ?? 'everyone'
  const name = a === 'private' ? privateName : sharedName
  const matches = (l: List) => {
    const la = audienceOf(l)
    if (a === 'private') return la === 'private' && l.ownerId === uid
    if (a === 'parents') return la === 'parents'
    return la === 'family' || la === 'everyone'
  }
  const found = editable.find((l) => l.kind === 'list' && l.name === name && matches(l))
  if (found) return found
  const list: Omit<List, 'id'> = { name, kind: 'list', ownerId: uid, defaultContext: 'family', ...privacyFields(a === 'shared' ? 'everyone' : a, uid, [], parents) }
  return { ...list, id: await createList(list) }
}

/** A "Read: <name>" task for a link, in `list`, carrying the address so the task opens it. */
export function addReadingTask(list: List, link: Pick<Task, 'id' | 'title' | 'url'>, uid: string) {
  return addTaskNow(list, { title: `Read: ${link.title}`, url: link.url, linkId: link.id, priority: 2, status: 'todo', context: list.defaultContext, durationDays: 1, dependsOn: [] }, uid)
}

/**
 * Where an add goes when no list is named: your inbox for your default privacy (Settings). Private: your own task
 * list named "Inbox" (or your first private task list). Family: the shared "Family Inbox". Created if missing.
 */
export async function inboxFor(uid: string, defaultAudience: Audience | undefined, editable: List[], parents: string[]): Promise<List> {
  const a = defaultAudience ?? 'everyone'
  return listForAudience('Inbox', a === 'parents' ? PARENTS_INBOX : FAMILY_INBOX, uid, a, editable, parents)
}

export async function createTask(list: List, input: TaskInput, uid: string) {
  const { id, written } = addTaskNow(list, input, uid)
  await written
  return id
}

/**
 * Adds a task (or item) and returns its id straight away: the new doc shows at once from the local write, and
 * `written` settles when the server confirms. Quick-add boxes clear immediately with this, so a second tap on a
 * slow connection can't add the same thing twice (that made 6 copies of one link).
 */
export function addTaskNow(list: List, input: TaskInput, uid: string): { id: string; written: Promise<void> } {
  const ref = doc(collection(db, 'tasks'))
  const { sharedWith, ...copied } = withoutDeletes(copiedFields(list)) as Partial<ReturnType<typeof copiedFields>>
  const written = setDoc(ref, {
    ...input,
    ...(list.kind === 'project' && !input.startDate ? { startDate: today() } : {}),
    listId: list.id,
    ...copied,
    ...(list.visibility === 'shared' ? { sharedWith } : {}),
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { id: ref.id, written }
}

/** Patch a task. Undefined values clear the field. Moving to another list re-copies that list's fields. */
export async function updateTask(id: string, patch: Partial<TaskInput>, moveTo?: List) {
  if (moveTo?.kind === 'project' && !patch.startDate) {
    const existing = await getDoc(doc(db, 'tasks', id))
    patch = { ...patch, startDate: existing.data()?.startDate || today() }
  }
  const data: Record<string, unknown> = { updatedAt: serverTimestamp() }
  for (const [k, v] of Object.entries(patch)) data[k] = v === undefined ? deleteField() : v
  if (moveTo) Object.assign(data, { listId: moveTo.id, ...copiedFields(moveTo) })
  return updateDoc(doc(db, 'tasks', id), data)
}

/** Deletes a task (or item, note, link) and the pictures stored on it that you added. */
export async function deleteTask(task: Pick<Task, 'id' | 'images'>) {
  await deleteDoc(doc(db, 'tasks', task.id))
  await deleteRemovedImages(task.images ?? [], [])
}

/** Apply a shift preview plus refreshed conflict flags as one batch (DESIGN.md §6.3). */
export function applySchedule(
  moves: Move[],
  conflicts: Map<string, string | undefined>,
  dependencies: DependencyChange[] = [],
  /** Other fields to write in the same batch, e.g. `pushedFrom` when "⏭ next day" moves dependents too. */
  extra: { id: string; data: Partial<TaskInput> }[] = [],
) {
  const batch = writeBatch(db)
  const ids = new Set([...moves.map((m) => m.id), ...conflicts.keys(), ...dependencies.map((change) => change.id), ...extra.map((e) => e.id)])
  for (const id of ids) {
    const m = moves.find((x) => x.id === id)
    const data: Record<string, unknown> = { updatedAt: serverTimestamp() }
    if (m) data.startDate = m.to
    if (m?.durationDays) data.durationDays = m.durationDays
    const dependency = dependencies.find((change) => change.id === id)
    if (dependency) data.dependsOn = dependency.after
    if (conflicts.has(id)) data.conflict = conflicts.get(id) ?? deleteField()
    for (const e of extra.filter((x) => x.id === id)) Object.assign(data, e.data)
    batch.update(doc(db, 'tasks', id), data)
  }
  return batch.commit()
}

// ---- Pick lists (DESIGN.md §5.8) ----

/** Your stars for a pick-list item (1–5), or undefined to clear them. Only your own rating changes. */
export function ratePick(itemId: string, uid: string, stars: number | undefined) {
  return updateDoc(doc(db, 'tasks', itemId), { [`ratings.${uid}`]: stars ?? deleteField(), updatedAt: serverTimestamp() })
}

/** Your flashcard result: "Got it" (known) or "Not yet", counted, with the day. Only your own entry changes. */
export function recordCard(itemId: string, uid: string, prev: { right?: number; wrong?: number } | undefined, known: boolean) {
  return updateDoc(doc(db, 'tasks', itemId), {
    [`results.${uid}`]: { known, right: (prev?.right ?? 0) + (known ? 1 : 0), wrong: (prev?.wrong ?? 0) + (known ? 0 : 1), last: today() },
    updatedAt: serverTimestamp(),
  })
}

/** Forget your flashcard results for these cards (Start over). */
export function resetCards(itemIds: string[], uid: string) {
  const batch = writeBatch(db)
  for (const id of itemIds) batch.update(doc(db, 'tasks', id), { [`results.${uid}`]: deleteField(), updatedAt: serverTimestamp() })
  return batch.commit()
}

/** Mark a pick-list item watched / played on a day (or take that day back). */
export function setWatched(itemId: string, day: string, watched: boolean) {
  return updateDoc(doc(db, 'tasks', itemId), { watched: watched ? arrayUnion(day) : arrayRemove(day), updatedAt: serverTimestamp() })
}

// ---- Stored pictures (images/{id}, DESIGN.md §5.7) ----

/**
 * Saves a picture (a JPEG data URL from the picture editor) and returns its id straight away, like addTaskNow:
 * the local write shows at once (also offline), and `written` settles when the server has it.
 */
export function addImage(data: string, width: number, height: number, uid: string): { id: string; written: Promise<void> } {
  const ref = doc(collection(db, 'images'))
  const written = setDoc(ref, { data, width, height, createdBy: uid, createdAt: serverTimestamp() })
  return { id: ref.id, written }
}

const imageCache = new Map<string, Promise<string>>()

/** A stored picture's data URL (fetched once per session; the device cache keeps it between visits). */
export function imageData(id: string): Promise<string> {
  let p = imageCache.get(id)
  if (!p) {
    p = getDoc(doc(db, 'images', id)).then((snap) => {
      const data = snap.data()?.data
      if (typeof data !== 'string') throw new Error('That picture was deleted.')
      return data
    })
    p.catch(() => imageCache.delete(id))
    imageCache.set(id, p)
  }
  return p
}

/**
 * After an entry is saved without some of its stored pictures, delete the ones you added (the rules refuse
 * anyone else's, which is fine: they stay until their owner removes them).
 */
export async function deleteRemovedImages(before: string[], after: string[]) {
  const kept = new Set(after)
  const gone = before.filter((src) => isStoredImage(src) && !kept.has(src)).map(storedImageId)
  await Promise.all(gone.map((id) => deleteDoc(doc(db, 'images', id)).then(() => imageCache.delete(id)).catch(() => undefined)))
}

// ---- Voting ----

export const STARTER_BOARDS = ['Movies & Shows', 'Restaurants & Meals', 'Weekend Activities', 'Travel Plans']

// New boards default to Everyone (the family and view-only accounts), like everything else.
export async function createBoard(name: string, viewerVisible = true) {
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

/** Edit an item's title and optional note / link / picture (an empty value removes it). */
export function updateItem(item: BoardItem, patch: Partial<Pick<BoardItem, 'title' | 'note' | 'url' | 'imageUrl' | 'links' | 'images'>>) {
  const data: Record<string, unknown> = { title: patch.title ?? item.title, status: item.status, updatedAt: serverTimestamp() }
  for (const k of ['note', 'url', 'imageUrl', 'links', 'images'] as const) if (k in patch) data[k] = patch[k]?.length ? patch[k] : deleteField()
  return updateDoc(doc(db, 'boards', item.boardId, 'items', item.id), data)
}

// ---- Comments (on any entry: boards, voting items, tasks / items / notes / links, goals) ----

/** Where an entry's comments live: the comments collection under it. */
export const commentThread = {
  board: (boardId: string) => `boards/${boardId}/comments`,
  boardItem: (boardId: string, itemId: string) => `boards/${boardId}/items/${itemId}/comments`,
  task: (taskId: string) => `tasks/${taskId}/comments`,
  goal: (goalId: string) => `goals/${goalId}/comments`,
}

/** Live comments in a thread, oldest first. */
export function subscribeComments(thread: string, onData: (comments: Comment[]) => void, onError: OnError) {
  return onSnapshot(
    collection(db, thread),
    (snap) => {
      const list = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Comment)
      const at = (c: Comment) => (c.createdAt ? c.createdAt.seconds + c.createdAt.nanoseconds / 1e9 : Infinity)
      onData(list.sort((a, b) => at(a) - at(b)))
    },
    onError,
  )
}

export function addComment(thread: string, text: string, uid: string) {
  return setDoc(doc(collection(db, thread)), { text: text.trim(), uid, createdAt: serverTimestamp() })
}

export function editComment(thread: string, comment: Comment, text: string) {
  return updateDoc(doc(db, thread, comment.id), { text: text.trim(), uid: comment.uid, edited: true })
}

export function deleteComment(thread: string, commentId: string) {
  return deleteDoc(doc(db, thread, commentId))
}

export function setVote(boardId: string, itemId: string, uid: string, tokens: number) {
  const ref = doc(db, 'boards', boardId, 'items', itemId, 'votes', uid)
  return tokens > 0 ? setDoc(ref, { uid, tokens, updatedAt: serverTimestamp() }) : deleteDoc(ref)
}
