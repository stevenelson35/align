import type { IconName } from '../components/UI/Icon'
import type { List } from '../types'

/** Each kind of list: its icon and name. */
export const LIST_KIND: Record<List['kind'], { icon: IconName; label: string }> = {
  list: { icon: 'todo', label: 'Tasks' },
  project: { icon: 'chain', label: 'Project' },
  checklist: { icon: 'check', label: 'Checklist' },
  notes: { icon: 'note', label: 'Notes' },
  links: { icon: 'link', label: 'Links' },
  picks: { icon: 'star', label: 'Pick list' },
  cards: { icon: 'book', label: 'Flashcards' },
  contacts: { icon: 'person', label: 'Contacts' },
  gifts: { icon: 'gift', label: 'Gift list' },
}

export function entryListLabel(list: Pick<List, 'kind'>): string {
  if (list.kind === 'list' || list.kind === 'project') return 'List'
  if (list.kind === 'notes') return 'Notes list'
  if (list.kind === 'links') return 'Links list'
  if (list.kind === 'cards') return 'Flashcard list'
  if (list.kind === 'contacts') return 'Contacts list'
  return LIST_KIND[list.kind].label
}
