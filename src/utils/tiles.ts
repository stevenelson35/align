// Today as tiles (DESIGN.md §13, refactor phase 3): one ordered list per person, saved on the household as
// `members.<uid>.today`. Anything can be a tile: a whole panel (Goals, Family Map, To Do…), a list, one entry (a
// person, a link, a task), or a part of a panel (one person's location, Wordle of the day, one item of The Daily).
// Group headings you name sit between them; everything after the "more" mark is folded into More….
import { DEFAULT_MORE, moreOf, TODAY_SECTIONS } from './today'

/** A tile, as saved: "kind:id" (or "more"). */
export type Tile = string
export type TileKind = 'panel' | 'list' | 'entry' | 'person' | 'game' | 'daily' | 'group' | 'more'

/** Where More… starts. */
export const MORE: Tile = 'more'
/** At most this many tiles (the rules allow a few more, so a full list can still be rearranged). */
export const MAX_TILES = 120
/** Panels that belong to a day (shown on other days too). To Do is one of them. */
export const DAY_PANELS = ['todo', 'goals', 'photos', 'daily'] as const

export const tile = (kind: Exclude<TileKind, 'more'>, id: string): Tile => `${kind}:${id}`

export function parseTile(t: Tile): { kind: TileKind; id: string } {
  if (t === MORE) return { kind: 'more', id: '' }
  const at = t.indexOf(':')
  return { kind: t.slice(0, at) as TileKind, id: t.slice(at + 1) }
}

const KINDS = new Set<TileKind>(['panel', 'list', 'entry', 'person', 'game', 'daily', 'group'])
const PANELS = new Set<string>(['todo', ...TODAY_SECTIONS.map((s) => s.id)])

/** Tiles this version knows how to show (others, from a newer version or a bad save, are skipped, not lost). */
export function known(t: Tile): boolean {
  if (t === MORE) return true
  const { kind, id } = parseTile(t)
  return KINDS.has(kind) && !!id && (kind !== 'panel' || PANELS.has(id))
}

/**
 * Today until you arrange it: what you had (your sections on the main page, then To Do, then your Shortcuts as a
 * group) and the rest in More…. Panels added later than your saved tiles are not added for you; they're in Add.
 */
export function defaultTiles(member: { todayMore?: string[]; todayItems?: string[] }): Tile[] {
  const more = member.todayMore ? moreOf(member) : new Set<string>(DEFAULT_MORE)
  const ids = TODAY_SECTIONS.map((s) => s.id as string)
  const shortcuts = (member.todayItems ?? []).map((id) => tile('entry', id))
  return [
    ...ids.filter((id) => !more.has(id)).map((id) => tile('panel', id)),
    tile('panel', 'todo'),
    ...(shortcuts.length ? [tile('group', 'Shortcuts'), ...shortcuts] : []),
    MORE,
    ...ids.filter((id) => more.has(id)).map((id) => tile('panel', id)),
  ]
}

/** Your tiles: as you arranged them, or the default. Always exactly one "more" mark; no repeats. */
export function tilesOf(member: { today?: string[]; todayMore?: string[]; todayItems?: string[] }): Tile[] {
  const saved = member.today ?? defaultTiles(member)
  const out = [...new Set(saved)]
  return out.includes(MORE) ? out : [...out, MORE]
}

/** The main page and More…. */
export function splitMore(tiles: Tile[]): { main: Tile[]; more: Tile[] } {
  const at = tiles.indexOf(MORE)
  return at < 0 ? { main: tiles, more: [] } : { main: tiles.slice(0, at), more: tiles.slice(at + 1) }
}

/** Adds a tile at the end of the main page (or of More…). Already there: unchanged. */
export function addTile(tiles: Tile[], t: Tile, toMore = false): Tile[] {
  if (tiles.includes(t)) return tiles
  const at = tiles.indexOf(MORE)
  if (toMore || at < 0) return [...tiles, t]
  return [...tiles.slice(0, at), t, ...tiles.slice(at)]
}

export const removeTile = (tiles: Tile[], t: Tile): Tile[] => (t === MORE ? tiles : tiles.filter((x) => x !== t))

/** Moves the tile at `from` to `to` (indexes in the whole list, the "more" mark included). */
export function moveTile(tiles: Tile[], from: number, to: number): Tile[] {
  if (from === to || from < 0 || from >= tiles.length) return tiles
  const out = [...tiles]
  const [t] = out.splice(from, 1)
  out.splice(Math.max(0, Math.min(to, out.length)), 0, t)
  return out
}

/** Renames a group (keeping its place). Empty or taken names are refused (unchanged). */
export function renameGroup(tiles: Tile[], from: string, to: string): Tile[] {
  const name = to.trim().replace(/\s+/g, ' ').slice(0, 40)
  if (!name || tiles.includes(tile('group', name))) return tiles
  return tiles.map((t) => (t === tile('group', from) ? tile('group', name) : t))
}

/** A new group's name: "Group", "Group 2", …. */
export function newGroupName(tiles: Tile[], base = 'Group'): string {
  for (let n = 1; ; n++) {
    const name = n === 1 ? base : `${base} ${n}`
    if (!tiles.includes(tile('group', name))) return name
  }
}

export interface TileGroup {
  /** The group heading (none for the tiles before the first heading). */
  name?: string
  tiles: Tile[]
}

/** Tiles under their group headings, in order. */
export function grouped(tiles: Tile[]): TileGroup[] {
  const out: TileGroup[] = [{ tiles: [] }]
  for (const t of tiles) {
    const { kind, id } = parseTile(t)
    if (kind === 'group') out.push({ name: id, tiles: [] })
    else out[out.length - 1].tiles.push(t)
  }
  return out.filter((g, i) => i > 0 || g.tiles.length)
}

/** Another day: only what belongs to a day (To Do, Goals, Archive Pics, The Daily), in your order. */
export function dayTiles(tiles: Tile[]): Tile[] {
  const day = DAY_PANELS.map((id) => tile('panel', id))
  const placed = tiles.filter((t) => day.includes(t))
  return [...placed, ...day.filter((t) => !placed.includes(t))]
}
