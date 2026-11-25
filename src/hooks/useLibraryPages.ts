import type { IconName } from '../components/UI/Icon'
import type { Route } from '../utils/routes'
import type { Tile } from '../utils/tiles'
import { useApp } from './useApp'
import { useInbox } from './useInbox'

/** What Find… sends to the Library's find box ("See everything"). */
export const LIBRARY_FIND_KEY = 'align-library-find'

/** A page in Align, as the Library and Find list it. */
export interface LibraryPage {
  label: string
  icon: IconName
  route?: Route
  onClick?: () => void
  badge?: number
  tile?: Tile
  members?: boolean
}

/** Every page in Align (members-only ones only for members), for the Library and Find. */
export function useLibraryPages(): LibraryPage[] {
  const app = useApp()
  const { unread } = useInbox()
  const pages: LibraryPage[] = [
    { label: 'Home (Today)', icon: 'home', route: { view: 'today' } },
    { label: 'Inbox', icon: 'mail', route: { view: 'inbox' }, badge: unread, tile: 'panel:inbox' },
    { label: 'Tasks', icon: 'todo', route: { view: 'home' } },
    { label: 'Goals', icon: 'goal', route: { view: 'goals' }, tile: 'panel:goals' },
    { label: 'Games', icon: 'sparkle', route: { view: 'games' }, tile: 'panel:games', members: true },
    { label: 'Family map', icon: 'map', route: { view: 'map' }, tile: 'panel:map', members: true },
    { label: 'Photos', icon: 'photo', route: { view: 'photos' } },
    { label: 'Periodic table', icon: 'sparkle', route: { view: 'elements' }, tile: 'panel:elements' },
    { label: 'Languages', icon: 'message', route: { view: 'languages' } },
    { label: 'Voting boards', icon: 'star', route: { view: 'boards' }, tile: 'panel:voting' },
    { label: 'New blog post', icon: 'compose', route: { view: 'blog' }, members: true },
    { label: 'Wall display', icon: 'calendar', route: { view: 'wall' } },
    { label: 'Help & about', icon: 'help', route: { view: 'help' } },
    { label: 'Settings', icon: 'settings', onClick: app.openSettings },
  ]
  return pages.filter((p) => !p.members || app.isMember)
}

