// Whose: the one filter used across Align (Tasks, Today's To Do, Goals, Lists), by whose responsibility a thing is:
// All; Mine (yours to do: your private ones, plus ones the family can see that only you can edit or that are assigned
// to you); Family (the family's: Family / Everyone, shared responsibility); Shared (shared with chosen people). Each
// thing is in exactly one of Mine / Family / Shared for a given person. Work is offered only where something uses it.

export type Whose = 'all' | 'mine' | 'family' | 'shared'
export const WHOSE: { value: Whose; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'Mine' },
  { value: 'family', label: 'Family' },
  { value: 'shared', label: 'Shared' },
]
export const WHOSE_VALUES: readonly Whose[] = WHOSE.map((w) => w.value)

interface Owned {
  visibility: string
  ownerId: string
  /** Who can edit it (absent: anyone who can see it); `editors` for chosen people or Parents. */
  editAudience?: string
  editors?: string[]
  assigneeId?: string
}

/** Yours to do: private and yours, or seen by others but only you can edit it, or assigned to you. */
export function isMine(d: Owned, uid: string): boolean {
  if (d.visibility === 'private') return d.ownerId === uid
  if (d.assigneeId === uid) return true
  if (d.ownerId !== uid) return false
  if (d.editAudience === 'private') return true
  return (d.editAudience === 'shared' || d.editAudience === 'parents') && !!d.editors?.length && d.editors.every((e) => e === uid)
}

/** Whether a list, task or goal passes the filter. */
export function whoseMatches(d: Owned, whose: Whose, uid: string): boolean {
  if (whose === 'all') return true
  const mine = isMine(d, uid)
  if (whose === 'mine') return mine
  if (whose === 'family') return !mine && d.visibility === 'family'
  return !mine && d.visibility === 'shared'
}
