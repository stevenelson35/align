import { describe, expect, it } from 'vitest'
import { audienceNarrows, audienceOf, canReadAs, peopleIn, privacyFields, viewCoveringEditors } from './audience'

describe('audience', () => {
  it('maps the five choices onto stored privacy fields and back', () => {
    const parents = ['steve', 'sam']
    for (const a of ['private', 'parents', 'family', 'shared', 'everyone'] as const) {
      expect(audienceOf(privacyFields(a, 'steve', ['alex'], parents))).toBe(a)
    }
    expect(privacyFields('everyone', 'steve', [], parents)).toEqual({ visibility: 'family', viewerVisible: true })
    expect(privacyFields('parents', 'steve', [], parents)).toEqual({ visibility: 'shared', viewerVisible: false, sharedWith: ['steve', 'sam'], audience: 'parents' })
    expect(privacyFields('shared', 'steve', ['alex'], parents).sharedWith).toEqual(['steve', 'alex'])
  })
  it('reads older docs without the audience marker', () => {
    expect(audienceOf({ visibility: 'shared', viewerVisible: false })).toBe('shared')
    expect(audienceOf({ visibility: 'family', viewerVisible: false })).toBe('family')
  })
  it('lists the people a choice covers', () => {
    expect(peopleIn('private', 'steve', [], ['sam'])).toEqual(['steve'])
    expect(peopleIn('parents', 'steve', [], ['sam'])).toEqual(['steve', 'sam'])
    expect(peopleIn('everyone', 'steve', [], [])).toBeNull()
  })
})

describe('viewCoveringEditors', () => {
  it('widens who can view so everyone who can log can see the goal', () => {
    expect(viewCoveringEditors('everyone', [], 'private', [], 'me', ['me', 'wife'])).toEqual({ view: 'everyone', viewChosen: [], widened: false })
    expect(viewCoveringEditors('private', [], 'family', [], 'me', [])).toMatchObject({ view: 'family', widened: true })
    expect(viewCoveringEditors('parents', [], 'shared', ['kid'], 'me', ['me', 'wife'])).toEqual({ view: 'shared', viewChosen: ['wife', 'kid'], widened: true })
    expect(viewCoveringEditors('shared', ['wife', 'kid'], 'parents', [], 'me', ['me', 'wife']).widened).toBe(false)
  })
})

describe('audienceNarrows (change-only sync)', () => {
  const fam = { visibility: 'family', ownerId: 's', viewerVisible: false }
  const everyone = { ...fam, viewerVisible: true }
  const mine = { visibility: 'private', ownerId: 's' }
  const shared = (who: string[]) => ({ visibility: 'shared', ownerId: 's', sharedWith: who })
  it('says yes when someone loses access', () => {
    expect(audienceNarrows(fam, mine)).toBe(true)
    expect(audienceNarrows(everyone, fam)).toBe(true)
    expect(audienceNarrows(fam, shared(['s', 'l']))).toBe(true)
    expect(audienceNarrows(shared(['s', 'l', 'c']), shared(['s', 'l']))).toBe(true)
    expect(audienceNarrows(shared(['s', 'l']), mine)).toBe(true)
    expect(audienceNarrows(mine, { ...mine, ownerId: 'l' })).toBe(true)
  })
  it('says no when everyone who had it still does', () => {
    expect(audienceNarrows(mine, fam)).toBe(false)
    expect(audienceNarrows(fam, everyone)).toBe(false)
    expect(audienceNarrows(fam, fam)).toBe(false)
    expect(audienceNarrows(shared(['s', 'l']), shared(['s', 'l', 'c']))).toBe(false)
    expect(audienceNarrows(mine, shared(['s', 'l']))).toBe(false)
    expect(audienceNarrows(shared(['s', 'l']), everyone)).toBe(false)
  })
})

describe('who can open a document', () => {
  it('follows the rules: owner for private, members (and allowed viewers) for family, the chosen for shared', () => {
    const own = { visibility: 'private', ownerId: 'steve' }
    expect(canReadAs(own, 'steve', 'member')).toBe(true)
    expect(canReadAs(own, 'wife', 'member')).toBe(false)
    const fam = { visibility: 'family', ownerId: 'steve' }
    expect(canReadAs(fam, 'wife', 'member')).toBe(true)
    expect(canReadAs(fam, 'grandma', 'viewer')).toBe(false)
    expect(canReadAs({ ...fam, viewerVisible: true }, 'grandma', 'viewer')).toBe(true)
    const shared = { visibility: 'shared', ownerId: 'steve', sharedWith: ['steve', 'grandma'] }
    expect(canReadAs(shared, 'grandma', 'viewer')).toBe(true)
    expect(canReadAs(shared, 'wife', 'member')).toBe(false)
    expect(canReadAs(fam, 'stranger', undefined)).toBe(false)
  })
})
