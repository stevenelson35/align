import { describe, expect, it } from 'vitest'
import { whoseMatches } from './whose'

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
})
