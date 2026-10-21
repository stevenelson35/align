// Who can see (or change) something, as five choices used everywhere (lists, goals, defaults):
// Only me · Parents · Family · Chosen people · Everyone. They map onto the stored privacy fields, so the rules
// and queries don't change: Family = members only; Everyone = members and viewer accounts; Parents and Chosen
// people = a sharedWith list (Parents is the Settings group at the time, marked `audience: 'parents'`).
import type { Household, Visibility } from '../types'

export type Audience = 'private' | 'parents' | 'family' | 'shared' | 'everyone'

export const AUDIENCES: { value: Audience; label: string; hint: string }[] = [
  { value: 'private', label: 'Only me', hint: 'Just you' },
  { value: 'parents', label: 'Parents', hint: 'The Parents group from Settings' },
  { value: 'family', label: 'Family', hint: 'Everyone with a household account' },
  { value: 'shared', label: 'Chosen people', hint: 'Pick names' },
  { value: 'everyone', label: 'Everyone', hint: 'The family and anyone with view-only access' },
]

export const DEFAULT_AUDIENCE: Audience = 'everyone'

export interface PrivacyFields {
  visibility: Visibility
  viewerVisible: boolean
  sharedWith?: string[]
  audience?: 'parents'
}

/** The choice a stored doc represents. */
export function audienceOf(d: Pick<PrivacyFields, 'visibility' | 'viewerVisible' | 'audience'>): Audience {
  if (d.visibility === 'private') return 'private'
  if (d.visibility === 'family') return d.viewerVisible ? 'everyone' : 'family'
  return d.audience === 'parents' ? 'parents' : 'shared'
}

export function parentsOf(household: Pick<Household, 'groups' | 'members'>): string[] {
  return (household.groups?.parents ?? []).filter((id) => household.members[id])
}

/** The fields to store for a choice. `chosen` is used for Chosen people; the owner is always included. */
export function privacyFields(a: Audience, ownerId: string, chosen: string[], parents: string[]): PrivacyFields {
  switch (a) {
    case 'private':
      return { visibility: 'private', viewerVisible: false }
    case 'family':
      return { visibility: 'family', viewerVisible: false }
    case 'everyone':
      return { visibility: 'family', viewerVisible: true }
    case 'parents':
      return { visibility: 'shared', viewerVisible: false, sharedWith: [...new Set([ownerId, ...parents])], audience: 'parents' }
    case 'shared':
      return { visibility: 'shared', viewerVisible: false, sharedWith: [...new Set([ownerId, ...chosen])] }
  }
}

/** The people a choice covers, when it's a list (Only me, Parents, Chosen people); null for Family / Everyone. */
export function peopleIn(a: Audience, ownerId: string, chosen: string[], parents: string[]): string[] | null {
  if (a === 'family' || a === 'everyone') return null
  return privacyFields(a, ownerId, chosen, parents).sharedWith ?? [ownerId]
}

export const AUDIENCE_ICON = { private: 'lock', parents: 'parents', family: 'family', shared: 'shared', everyone: 'everyone' } as const

export function audienceLabel(a: Audience): string {
  return AUDIENCES.find((x) => x.value === a)!.label
}

/**
 * Goals have "who can view" and "who can log". Anyone who can log must be able to see it, so a narrower view is
 * widened to cover them: Family / Everyone loggers need at least Family viewers; named loggers are added to named
 * viewers. Returns the view to store and whether it was widened (to say so in the editor).
 */
export function viewCoveringEditors(
  view: Audience,
  viewChosen: string[],
  edit: Audience,
  editChosen: string[],
  ownerId: string,
  parents: string[],
): { view: Audience; viewChosen: string[]; widened: boolean } {
  const same = { view, viewChosen, widened: false }
  if (edit === 'private' || view === 'family' || view === 'everyone') return same
  if (edit === 'family' || edit === 'everyone') return { view: 'family', viewChosen, widened: true }
  const viewers = new Set(peopleIn(view, ownerId, viewChosen, parents))
  const editors = peopleIn(edit, ownerId, editChosen, parents)!
  const missing = editors.filter((id) => !viewers.has(id))
  if (!missing.length) return same
  return { view: 'shared', viewChosen: [...viewers, ...missing].filter((id) => id !== ownerId), widened: true }
}
