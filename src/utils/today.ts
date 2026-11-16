// Today's panels (DESIGN.md §8): the built-in tiles. How Today is arranged is tiles (utils/tiles.ts).

export const TODAY_SECTIONS = [
  { id: 'inbox', label: 'Inbox' },
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
