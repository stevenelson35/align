// How Today is arranged (DESIGN.md §8): sections on the main page or folded into More…, per person.

export const TODAY_SECTIONS = [
  { id: 'goals', label: 'Goals' },
  { id: 'map', label: 'Family Map' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'gifts', label: 'Gifts' },
  { id: 'lists', label: 'Lists' },
  { id: 'links', label: 'Links' },
  { id: 'projects', label: 'Projects' },
  { id: 'cards', label: 'Flashcards' },
  { id: 'photos', label: 'Archive Pics' },
  { id: 'daily', label: 'The Daily' },
] as const

export type TodaySection = (typeof TODAY_SECTIONS)[number]['id']

/** Until someone arranges Today themselves, the less-used sections start in More…. */
export const DEFAULT_MORE: TodaySection[] = ['gifts', 'lists', 'links', 'projects', 'cards']

/** The sections in More… for this person (their arrangement, or the defaults). */
export const moreOf = (member: { todayMore?: string[] }): Set<string> => new Set(member.todayMore ?? DEFAULT_MORE)
