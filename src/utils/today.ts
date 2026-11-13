// Today's panels (DESIGN.md §8). How Today is arranged is now tiles (utils/tiles.ts); `moreOf` reads the older
// arrangement (sections moved into More…), which a person's tiles start from until they arrange them.

export const TODAY_SECTIONS = [
  { id: 'goals', label: 'Goals' },
  { id: 'rewards', label: 'Reveal' },
  { id: 'games', label: 'Games' },
  { id: 'map', label: 'Family Map' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'gifts', label: 'Gifts' },
  { id: 'lists', label: 'Lists' },
  { id: 'links', label: 'Links' },
  { id: 'projects', label: 'Projects' },
  { id: 'cards', label: 'Flashcards' },
  { id: 'photos', label: 'Archive Pics' },
  { id: 'daily', label: 'The Daily' },
  { id: 'voting', label: 'Voting' },
  { id: 'invest', label: 'Investing' },
] as const

export type TodaySection = (typeof TODAY_SECTIONS)[number]['id']

/** Until someone arranges Today themselves, the less-used sections start in More…. */
export const DEFAULT_MORE: TodaySection[] = ['gifts', 'lists', 'links', 'projects', 'cards', 'voting', 'invest']

/**
 * Sections added after people had already arranged Today: they start in More… even for them, until moved to the
 * main page (saved as "!id" in their arrangement, since "not in More…" can't tell new from moved).
 */
export const ADDED_TO_MORE: TodaySection[] = ['voting', 'invest']

/** The sections in More… for this person (their arrangement, or the defaults). */
export function moreOf(member: { todayMore?: string[] }): Set<string> {
  if (!member.todayMore) return new Set(DEFAULT_MORE)
  const saved = new Set(member.todayMore)
  for (const id of ADDED_TO_MORE) if (!saved.has(`!${id}`)) saved.add(id)
  return saved
}
