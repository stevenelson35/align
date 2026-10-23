import { describe, expect, it } from 'vitest'
import { canEditTask } from './tasks'

describe('canEditTask (who can edit)', () => {
  const base = { visibility: 'family' as const, ownerId: 'steve' }
  it('keeps the old rule when a list has no "who can edit"', () => {
    expect(canEditTask(base, 'wife', 'member')).toBe(true)
    expect(canEditTask(base, 'grandma', 'viewer')).toBe(false)
  })
  it('lets only the owner or the chosen editors change a view-for-all list', () => {
    expect(canEditTask({ ...base, editAudience: 'private' }, 'wife', 'member')).toBe(false)
    expect(canEditTask({ ...base, editAudience: 'private' }, 'steve', 'member')).toBe(true)
    expect(canEditTask({ ...base, editAudience: 'shared', editors: ['steve', 'wife'] }, 'wife', 'member')).toBe(true)
    expect(canEditTask({ ...base, editAudience: 'shared', editors: ['steve', 'wife'] }, 'daughter', 'member')).toBe(false)
    expect(canEditTask({ ...base, editAudience: 'family' }, 'daughter', 'member')).toBe(true)
  })
})
