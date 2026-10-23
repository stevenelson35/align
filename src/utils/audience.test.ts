import { describe, expect, it } from 'vitest'
import { audienceOf, peopleIn, privacyFields, viewCoveringEditors } from './audience'

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
