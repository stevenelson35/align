import { describe, expect, it } from 'vitest'
import { isMine, whoseMatches } from './whose'

describe('whose filter', () => {
  it('sorts lists, tasks and goals into mine / family / shared', () => {
    const mine = { visibility: 'private', ownerId: 'steve' }
    const theirs = { visibility: 'private', ownerId: 'wife' }
    const fam = { visibility: 'family', ownerId: 'wife' }
    const shared = { visibility: 'shared', ownerId: 'wife' }
    expect([mine, theirs, fam, shared].filter((d) => whoseMatches(d, 'mine', 'steve'))).toEqual([mine])
    expect([mine, fam, shared].filter((d) => whoseMatches(d, 'family', 'steve'))).toEqual([fam])
    expect([mine, fam, shared].filter((d) => whoseMatches(d, 'shared', 'steve'))).toEqual([shared])
    expect([mine, fam, shared].filter((d) => whoseMatches(d, 'all', 'steve'))).toHaveLength(3)
  })

  it('counts things the family can see but only you edit (or that are yours to do) as Mine, not Family', () => {
    const project = { visibility: 'family', ownerId: 'steve', editAudience: 'private' }
    expect(whoseMatches(project, 'mine', 'steve')).toBe(true)
    expect(whoseMatches(project, 'family', 'steve')).toBe(false)
    // For everyone else it's still the family's (if they choose to see it).
    expect(whoseMatches(project, 'family', 'wife')).toBe(true)
    expect(whoseMatches(project, 'mine', 'wife')).toBe(false)
    // Assigned to you on a family list: yours.
    expect(isMine({ visibility: 'family', ownerId: 'wife', assigneeId: 'steve' }, 'steve')).toBe(true)
    // Chosen editors of just you: yours; you and someone else: shared responsibility.
    expect(isMine({ visibility: 'family', ownerId: 'steve', editAudience: 'shared', editors: ['steve'] }, 'steve')).toBe(true)
    expect(isMine({ visibility: 'family', ownerId: 'steve', editAudience: 'shared', editors: ['steve', 'wife'] }, 'steve')).toBe(false)
    // A family list anyone can edit stays Family, even though you own it.
    expect(whoseMatches({ visibility: 'family', ownerId: 'steve' }, 'family', 'steve')).toBe(true)
  })
})
