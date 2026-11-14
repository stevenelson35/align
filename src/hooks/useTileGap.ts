import { useSyncExternalStore } from 'react'

// The space between Today's tiles (and inside groups), per device: a phone and an unfolded Fold may want different
// spacing. Changed in Arrange or Settings; every Today on the device follows at once.
const KEY = 'align-tile-gap'
/** The choices, in rem. */
export const TILE_GAPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const
export const DEFAULT_TILE_GAP = 1
const listeners = new Set<() => void>()

function read(): number {
  const v = Number(localStorage.getItem(KEY))
  return (TILE_GAPS as readonly number[]).includes(v) ? v : DEFAULT_TILE_GAP
}

export function setTileGap(rem: number) {
  localStorage.setItem(KEY, String(rem))
  listeners.forEach((l) => l())
}

/** The space between tiles, in rem, live. */
export function useTileGap(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    read,
  )
}
