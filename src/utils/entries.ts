// Entries (DESIGN.md §13, refactor phase 2): every list item (task, checklist item, note, link, title, card,
// person, gift idea) is one entry with optional parts, shown by one row (EntryRow) in three sizes.
import type { List } from '../types'

export type EntrySize = 'simple' | 'medium' | 'detail'
export const ENTRY_SIZES: { value: EntrySize; label: string }[] = [
  { value: 'simple', label: 'Simple' },
  { value: 'medium', label: 'Medium' },
  { value: 'detail', label: 'Detail' },
]
export const ENTRY_SIZE_VALUES = ENTRY_SIZES.map((s) => s.value)

/** How a list starts out (each list then remembers your choice on this device). */
export function defaultSize(kind: List['kind']): EntrySize {
  if (kind === 'notes') return 'detail'
  if (kind === 'checklist' || kind === 'cards') return 'simple'
  return 'medium'
}

/** Where a list's size is remembered on this device. */
export const sizeKey = (listId: string) => `align-entry-size:${listId}`
