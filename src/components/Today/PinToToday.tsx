import { useState } from 'react'
import { useTodayTiles } from '../../hooks/useTodayTiles'
import type { Tile } from '../../utils/tiles'
import { Icon } from '../UI/Icon'

/** Pin a list or an entry to Today (a tile at the end of the main page), or take it off. Members only. */
export function PinToToday({ tile, className = 'secondary small' }: { tile: Tile; className?: string }) {
  const today = useTodayTiles()
  const [error, setError] = useState<string | null>(null)
  if (!today.canChange) return null
  const on = today.has(tile)
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          setError(null)
          today.toggle(tile).catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
        }}
        aria-pressed={on}
        title={on ? 'On your Today (tap to take it off)' : 'Show this on your Today'}
      >
        <Icon name="pin" /> {on ? 'On Today ✓' : 'Pin to Today'}
      </button>
      {error && <span className="error small">{error}</span>}
    </>
  )
}
