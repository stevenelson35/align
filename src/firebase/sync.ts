// Change-only sync (DESIGN.md §13, refactor phase 1). Lists, entries and goals used to be read in full on every
// open (Firestore bills a read per document a listener returns, unless the app was open in the last 30 minutes):
// about 1,600 reads an open. Now each device shows its saved copy at once, then asks only for documents changed
// since the newest one it has, and keeps listening for changes. Deleting marks a document `deleted` (a real delete
// would never show up in a "changed since" query). Once a day it loads everything again, which also drops anything
// you can no longer see (narrowing who can see a document doesn't reach devices that only ask for changes).
import {
  deleteDoc,
  onSnapshot,
  query,
  Timestamp,
  where,
  type DocumentData,
  type DocumentReference,
  type FirestoreError,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'

/** A full load at least this often (per device, person and collection). */
export const FULL_SYNC_MS = 24 * 3600000
/** Ask for changes from a little before the newest change we have (clock edges, writes landing together). */
export const SYNC_MARGIN_MS = 2 * 60000
/** Deleted marks older than this are removed for good by the next full load (by whoever may delete them). */
export const PURGE_AFTER_MS = 30 * 86400000

export interface Synced {
  id: string
  deleted?: boolean
  updatedAt?: { toMillis(): number } | null
  ownerId?: string
  createdBy?: string
}

/** How the last start went, per collection (for checking the savings; also on window.__alignSync). */
export interface SyncReport {
  mode: 'full' | 'changes'
  fromCache: number
  fromServer: number
}
export const syncReports: Record<string, SyncReport> = {}
if (typeof window !== 'undefined') (window as unknown as { __alignSync: typeof syncReports }).__alignSync = syncReports

const millis = (d: Synced) => (d.updatedAt && typeof d.updatedAt.toMillis === 'function' ? d.updatedAt.toMillis() : 0)

/** The time to ask for changes from: the newest change we hold, less the margin (0: nothing to go on). */
export function changesSince(docs: Iterable<Synced>): number {
  let newest = 0
  for (const d of docs) newest = Math.max(newest, millis(d))
  return newest ? newest - SYNC_MARGIN_MS : 0
}

/**
 * Whether to load everything this time: no saved copy, no full load on record, the last one is a day old, or
 * someone narrowed who can see something since (`accessChangedAt`, ms).
 */
export function needsFullSync(cached: number, lastFull: number, now = Date.now(), accessChangedAt = 0): boolean {
  return cached === 0 || !lastFull || now - lastFull > FULL_SYNC_MS || accessChangedAt > lastFull
}

function readGone(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Old deleted marks this person may remove for good (their own; anything else is left for its owner). */
export function purgeable(docs: Iterable<Synced>, uid: string, now = Date.now()): string[] {
  const out: string[] = []
  for (const d of docs) if (d.deleted && millis(d) && now - millis(d) > PURGE_AFTER_MS && (d.ownerId === uid || d.createdBy === uid)) out.push(d.id)
  return out
}

/**
 * Live data for one collection, from the queries the rules allow (one per kind of access). `key` names where the
 * last full load is remembered (per device slot and person). Returns an unsubscribe function.
 *
 * Two listeners per query: one on this device's saved copy only (`source: 'cache'`: no reads billed, and it
 * includes your own writes at once, before the server has stamped them), which is what's shown; and one to the
 * server, for everything (a full load) or only what changed, which keeps the saved copy up to date.
 */
export function subscribeSynced<T extends Synced>(
  name: string,
  key: string,
  uid: string,
  queries: Query<DocumentData>[],
  convert: (snap: QueryDocumentSnapshot<DocumentData>) => T,
  onData: (items: T[]) => void,
  onError: (error: FirestoreError) => void,
  /** The document with this id, for removing old deleted marks. */
  refFor: (id: string) => DocumentReference<DocumentData>,
  /** The household's last access narrowing (ms): newer than the last full load means load in full. */
  accessChangedAt = 0,
): () => void {
  // What the saved copy holds for each query (shown), and documents the server says we can no longer see (which
  // the saved copy may still hold).
  const local = queries.map(() => new Map<string, T>())
  // Kept on the device: the saved copy keeps documents we lost access to, and they mustn't come back on the next
  // open (which only asks for changes) before the next full load.
  const goneKey = `${key}:gone`
  const dropped = new Set<string>(readGone(goneKey))
  const saveGone = () => localStorage.setItem(goneKey, JSON.stringify([...dropped].slice(-1000)))
  // Which server query each document came in through, so one leaving a query is dropped only when no other has it.
  const through = queries.map(() => new Set<string>())
  const unsubs: (() => void)[] = []
  let stopped = false
  const emit = () => {
    const all = new Map<string, T>()
    for (const m of local) for (const [id, d] of m) if (!dropped.has(id)) all.set(id, d)
    onData([...all.values()].filter((d) => !d.deleted))
  }

  // 1. The saved copy, live (and straight away). Once every query has answered, start on the server.
  const firstLocal = queries.map(() => false)
  let serverStarted = false
  queries.forEach((q, i) => {
    unsubs.push(
      onSnapshot(
        q,
        { source: 'cache' },
        (snap) => {
          local[i] = new Map(snap.docs.map((d) => [d.id, convert(d)]))
          firstLocal[i] = true
          emit()
          if (!serverStarted && firstLocal.every(Boolean)) {
            serverStarted = true
            startServer()
          }
        },
        onError,
      ),
    )
  })

  // 2. The server: everything, or only what changed since the newest change we hold.
  function startServer() {
    if (stopped) return
    const held = new Map<string, T>()
    for (const m of local) for (const [id, d] of m) held.set(id, d)
    const lastFull = Number(localStorage.getItem(key) ?? 0)
    const full = needsFullSync(held.size, lastFull, Date.now(), accessChangedAt)
    const report: SyncReport = { mode: full ? 'full' : 'changes', fromCache: held.size, fromServer: 0 }
    syncReports[name] = report
    const since = changesSince(held.values())
    const startedAt = Date.now()
    const ready = queries.map(() => false)
    const listen = (q: Query<DocumentData>, i: number, changesOnly: boolean) => {
      const live = changesOnly ? query(q, where('updatedAt', '>', Timestamp.fromMillis(since))) : q
      unsubs.push(
        onSnapshot(
          live,
          (snap) => {
            if (!snap.metadata.fromCache) report.fromServer += snap.docChanges().length
            let changed = false
            for (const change of snap.docChanges()) {
              const id = change.doc.id
              if (change.type === 'removed') {
                through[i].delete(id)
                // No longer visible through any query (narrowed access, or removed for good): stop showing it.
                if (!through.some((s) => s.has(id)) && !dropped.has(id)) {
                  dropped.add(id)
                  changed = true
                }
              } else {
                through[i].add(id)
                if (dropped.delete(id)) changed = true // visible again (re-shared)
              }
            }
            if (full && !snap.metadata.fromCache && !ready[i]) {
              ready[i] = true
              if (ready.every(Boolean)) {
                // Everything is in: what the server didn't give us is gone (deleted for good, or no longer ours to
                // see). Remember the full load, and clear out our own old deleted marks.
                // A full load is the truth: start the gone list over from it.
                dropped.clear()
                for (const id of held.keys()) if (!through.some((s) => s.has(id))) dropped.add(id)
                changed = true
                localStorage.setItem(key, String(startedAt))
                const shown = new Map<string, T>()
                for (const m of local) for (const [id, d] of m) shown.set(id, d)
                for (const id of purgeable(shown.values(), uid)) void deleteDoc(refFor(id)).catch(() => {}) // not ours to remove: left
              }
            }
            // The saved copy (and so the listener above) has the new data; this only matters for what's dropped.
            if (changed) {
              saveGone()
              emit()
            }
          },
          (error) => {
            // A "changed since" query the database can't answer yet (its index still building after a deploy):
            // ask for everything instead, rather than showing an error.
            if (changesOnly && error.code === 'failed-precondition') {
              report.mode = 'full'
              listen(q, i, false)
            } else onError(error)
          },
        ),
      )
    }
    queries.forEach((q, i) => listen(q, i, !full && !!since))
  }

  return () => {
    stopped = true
    unsubs.forEach((u) => u())
  }
}
