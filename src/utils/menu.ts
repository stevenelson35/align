// Which ☰ menu section a list sits in (the menu and the list pages' breadcrumb use the same rule). Task lists go by
// who can see them; every other kind has its own section.
import type { List } from '../types'

export const MENU_OPEN_KEY = 'align-menu-open'

export function menuSectionOf(list: Pick<List, 'kind' | 'visibility'>): string {
  switch (list.kind) {
    case 'project':
      return 'Projects'
    case 'checklist':
      return 'Checklists'
    case 'notes':
      return 'Notes'
    case 'links':
      return 'Links'
    case 'picks':
      return 'Pick lists'
    case 'cards':
      return 'Flashcards'
    default:
      return list.visibility === 'private' ? 'My lists' : list.visibility === 'family' ? 'Family lists' : 'Shared lists'
  }
}
