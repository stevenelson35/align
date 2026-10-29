// Whose: the one filter used across Align (Tasks, Today's To Do, Goals, Lists): All, Mine (your private ones),
// Family (Family and Everyone), Shared (shared with chosen people). Work is offered only where something uses it.

export type Whose = 'all' | 'mine' | 'family' | 'shared'
export const WHOSE: { value: Whose; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'Mine' },
  { value: 'family', label: 'Family' },
  { value: 'shared', label: 'Shared' },
]
export const WHOSE_VALUES: readonly Whose[] = WHOSE.map((w) => w.value)

/** Whether a list, task or goal passes the filter. */
export function whoseMatches(d: { visibility: string; ownerId: string }, whose: Whose, uid: string): boolean {
  if (whose === 'mine') return d.visibility === 'private' && d.ownerId === uid
  if (whose === 'family') return d.visibility === 'family'
  if (whose === 'shared') return d.visibility === 'shared'
  return true
}
