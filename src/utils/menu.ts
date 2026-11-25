// Which ☰ menu section a list sits in (the menu and the list pages' breadcrumb use the same rule). Task lists are all
// under Lists (each shows who can see it); every other kind has its own section.
import type { IconName } from '../components/UI/Icon'
import type { List, Task } from '../types'
import { isFinished, isItemList } from './tasks'

export const MENU_OPEN_KEY = 'align-menu-open'
/** Set by the breadcrumb: the section the menu scrolls to the top when it opens (once). */
export const MENU_SCROLL_KEY = 'align-menu-scroll'

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
    case 'contacts':
      return 'Contacts'
    case 'gifts':
      return 'Gifts'
    default:
      return 'Lists'
  }
}

/** The kinds of lists, as the Library and each kind's own page name them (menu order), with their icons. */
export const SECTIONS: { title: string; icon: IconName; kind: List['kind'] }[] = [
  { title: 'Lists', icon: 'list', kind: 'list' },
  { title: 'Projects', icon: 'chain', kind: 'project' },
  { title: 'Checklists', icon: 'check', kind: 'checklist' },
  { title: 'Notes', icon: 'note', kind: 'notes' },
  { title: 'Links', icon: 'link', kind: 'links' },
  { title: 'Pick lists', icon: 'star', kind: 'picks' },
  { title: 'Flashcards', icon: 'book', kind: 'cards' },
  { title: 'Contacts', icon: 'person', kind: 'contacts' },
  { title: 'Gifts', icon: 'gift', kind: 'gifts' },
]

/** The lists in a section you'd browse: not gift lists' hidden companions, nor someone else's private lists. A–Z. */
export const listsInSection = (lists: List[], title: string, uid: string) =>
  lists.filter((l) => menuSectionOf(l) === title && !l.giftSecret && (l.visibility !== 'private' || l.ownerId === uid)).sort((a, b) => a.name.localeCompare(b.name))

/** How much is on a list, in words: "3 open", "12 notes", "5 ideas". */
export function listSize(l: List, tasks: Task[], items: Task[]): string {
  const n = (isItemList(l) ? items : tasks).filter((t) => t.listId === l.id && (l.kind === 'notes' || l.kind === 'links' || l.kind === 'contacts' || l.kind === 'cards' || !isFinished(t))).length
  const one = n === 1
  const unit =
    l.kind === 'notes' ? (one ? 'note' : 'notes') : l.kind === 'links' ? (one ? 'link' : 'links') : l.kind === 'cards' ? (one ? 'card' : 'cards') : l.kind === 'contacts' ? (one ? 'person' : 'people') : l.kind === 'gifts' ? (one ? 'idea' : 'ideas') : 'open'
  return `${n} ${unit}`
}
