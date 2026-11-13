import { useMemo } from 'react'
import { DAILY_ITEMS, type DailyItem } from '../../daily/settings'
import { gameById } from '../../games/catalog'
import { useApp, useData } from '../../hooks/useApp'
import type { List, Task } from '../../types'
import { LIST_KIND } from '../../utils/listKinds'
import { formatDay } from '../../engine/dates'
import { isItemList } from '../../utils/tasks'
import { parseTile, type Tile } from '../../utils/tiles'
import { TODAY_SECTIONS } from '../../utils/today'
import type { IconName } from '../UI/Icon'

export const PANEL_ICON: Record<string, IconName> = {
  todo: 'todo',
  goals: 'goal',
  rewards: 'photo',
  games: 'sparkle',
  map: 'map',
  contacts: 'person',
  gifts: 'gift',
  lists: 'list',
  links: 'link',
  projects: 'chain',
  cards: 'book',
  photos: 'photo',
  daily: 'sun',
  voting: 'star',
  invest: 'coin',
}

export const panelLabel = (id: string) => (id === 'todo' ? 'To Do' : (TODAY_SECTIONS.find((s) => s.id === id)?.label ?? id))
export const dailyLabel = (id: string) => DAILY_ITEMS.find((i) => i.value === (id as DailyItem))?.label ?? id

export interface TileInfo {
  label: string
  /** What kind of tile, in words ("Panel", "Checklist", "Location"). */
  kind: string
  icon: IconName
  /** What it points at is gone (deleted, or no longer shared with you): shown only while arranging, to remove. */
  missing?: boolean
  list?: List
  entry?: Task
}

/** What a tile is, for arranging and Add to Today: its name, kind and icon, and whether it still exists. */
export function useTileInfo(): (t: Tile) => TileInfo {
  const app = useApp()
  const { lists, tasks, listItems } = useData()
  const entries = useMemo(() => new Map([...tasks, ...listItems].map((t) => [t.id, t])), [tasks, listItems])
  const listsById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists])
  return (t: Tile): TileInfo => {
    const { kind, id } = parseTile(t)
    switch (kind) {
      case 'panel':
        return { label: panelLabel(id), kind: 'Panel', icon: PANEL_ICON[id] ?? 'list' }
      case 'list': {
        const list = listsById.get(id)
        return list ? { label: list.name, kind: LIST_KIND[list.kind].label, icon: LIST_KIND[list.kind].icon, list } : { label: 'A list no longer here', kind: 'List', icon: 'list', missing: true }
      }
      case 'entry': {
        const entry = entries.get(id)
        const list = entry && listsById.get(entry.listId)
        if (!entry) return { label: 'An entry no longer here', kind: 'Entry', icon: 'note', missing: true }
        const icon: IconName = entry.contact ? 'person' : list ? LIST_KIND[list.kind].icon : 'todo'
        // A task's day tells repeats apart (a weekly calendar event is one entry a week).
        const when = !isItemList(list ?? { kind: 'list' }) && entry.startDate ? ` · ${formatDay(entry.startDate)}` : ''
        return { label: entry.title, kind: `${list ? list.name : 'Entry'}${when}`, icon, list, entry }
      }
      case 'person': {
        const m = app.household.members[id]
        return m ? { label: `${m.displayName}’s location`, kind: 'Family Map', icon: 'map' } : { label: 'Someone no longer in the family', kind: 'Location', icon: 'map', missing: true }
      }
      case 'game':
        return id === 'wordle'
          ? { label: 'Wordle of the day', kind: 'Game', icon: 'sparkle' }
          : { label: gameById(id)?.name ?? id, kind: 'Game', icon: 'sparkle', missing: !gameById(id) }
      case 'daily':
        return { label: dailyLabel(id), kind: 'The Daily', icon: 'sun', missing: !DAILY_ITEMS.some((i) => i.value === id) }
      case 'group':
        return { label: id, kind: 'Group', icon: 'list' }
      default:
        return { label: 'More…', kind: '', icon: 'more' }
    }
  }
}
