import { setTodayTiles } from '../firebase/db'
import { addTile, removeTile, tilesOf, type Tile } from '../utils/tiles'
import { useApp } from './useApp'

/** Your Today tiles (utils/tiles.ts), and changing them (saved for every device). */
export function useTodayTiles() {
  const { uid, member, isMember } = useApp()
  const tiles = tilesOf(member)
  const save = (next: Tile[]) => setTodayTiles(uid, next)
  return {
    tiles,
    /** Members only (viewers can't save an arrangement). */
    canChange: isMember,
    has: (t: Tile) => tiles.includes(t),
    save,
    add: (t: Tile, toMore = false) => save(addTile(tiles, t, toMore)),
    remove: (t: Tile) => save(removeTile(tiles, t)),
    toggle: (t: Tile) => save(tiles.includes(t) ? removeTile(tiles, t) : addTile(tiles, t)),
  }
}
