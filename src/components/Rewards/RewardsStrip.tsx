import { useState } from 'react'
import { useApp } from '../../hooks/useApp'
import { useRewards } from '../../hooks/useRewards'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { SectionHeader } from '../UI/SectionHeader'
import { IcePicture } from './IcePicture'

/**
 * Reveal on Today (members): the family photo being uncovered, how far along it is, your moves, and the next
 * reward on the ladder. Play opens the game.
 */
export function RewardsStrip() {
  const app = useApp()
  const r = useRewards()
  const [open, setOpen] = useStoredFlag('align-today-rewards', false)
  const [error, setError] = useState<string | null>(null)
  if (!app.isMember) return null
  const play = () => app.navigate({ view: 'reveal' })
  return (
    <div className="day-section rewards-strip">
      <SectionHeader icon="sparkle" title="Reveal" count={r.reveal ? `${r.pct}%` : undefined} onTitleClick={() => setOpen(!open)} expanded={open} help="rewards">
        {r.reveal && (
          <button type="button" className="link small" onClick={play}>
            Play
          </button>
        )}
        <button type="button" className="link small" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'}
        </button>
      </SectionHeader>
      {open &&
        (r.reveal === undefined ? null : r.reveal === null ? (
          <div className="rewards-start">
            <p className="muted small">Uncover a family photo together: each goal you meet is a move.</p>
            <button type="button" className="small" onClick={() => r.startNext().then(play).catch((err) => setError(err instanceof Error ? err.message : String(err)))}>
              Start a reveal
            </button>
            {error && <p className="error small">{error}</p>}
          </div>
        ) : (
          <div className="rewards-today">
            <button type="button" className="rewards-thumb" onClick={play} aria-label="Open the reveal">
              <IcePicture photoId={r.reveal.photoId} cols={r.reveal.cols} rows={r.reveal.rows} left={r.left} thick={r.reveal.thick} size={640} />
            </button>
            <p className="rewards-facts small">
              <strong>{r.done ? 'Uncovered!' : `${r.pct}%`}</strong>
              {!r.done && (r.moves ? ` · ${r.moves} ${r.moves === 1 ? 'move' : 'moves'}` : ' · no moves yet')}
              <br />
              <button type="button" className="link small" onClick={play}>
                {r.done ? 'See it' : 'Play'}
              </button>
            </p>
          </div>
        ))}
    </div>
  )
}
