import { describe, expect, it } from 'vitest'
import { changesSince, FULL_SYNC_MS, needsFullSync, PURGE_AFTER_MS, purgeable, SYNC_MARGIN_MS } from './sync'

const at = (ms: number) => ({ toMillis: () => ms })

describe('change-only sync', () => {
  it('asks for changes from the newest one held, less a margin', () => {
    expect(changesSince([{ id: 'a', updatedAt: at(5_000_000) }, { id: 'b', updatedAt: at(9_000_000) }, { id: 'c', updatedAt: null }])).toBe(9_000_000 - SYNC_MARGIN_MS)
    expect(changesSince([])).toBe(0)
  })

  it('loads everything with no saved copy, no full load on record, or once a day', () => {
    const now = 100 * FULL_SYNC_MS
    expect(needsFullSync(0, now - 1000, now)).toBe(true)
    expect(needsFullSync(500, 0, now)).toBe(true)
    expect(needsFullSync(500, now - FULL_SYNC_MS - 1, now)).toBe(true)
    expect(needsFullSync(500, now - 3600000, now)).toBe(false)
    // Someone narrowed who can see something after this device's last full load.
    expect(needsFullSync(500, now - 3600000, now, now - 60000)).toBe(true)
    expect(needsFullSync(500, now - 3600000, now, now - 7200000)).toBe(false)
  })

  it('clears only its own deleted marks, once they’re a month old', () => {
    const now = 100 * PURGE_AFTER_MS
    const old = at(now - PURGE_AFTER_MS - 1)
    const docs = [
      { id: 'mine', deleted: true, updatedAt: old, ownerId: 'steve' },
      { id: 'iAdded', deleted: true, updatedAt: old, ownerId: 'linda', createdBy: 'steve' },
      { id: 'theirs', deleted: true, updatedAt: old, ownerId: 'linda', createdBy: 'linda' },
      { id: 'recent', deleted: true, updatedAt: at(now - 1000), ownerId: 'steve' },
      { id: 'alive', updatedAt: old, ownerId: 'steve' },
    ]
    expect(purgeable(docs, 'steve', now)).toEqual(['mine', 'iAdded'])
  })
})
