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
  const [open, setOpen] = useStoredFlag('align-today-rewards', true)
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
            <p className="muted small">Uncover a family photo together. Every goal anyone meets is a spark, and each spark is a move in a little match game that breaks the ice over the picture.</p>
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
            <div className="rewards-facts small">
              <p>
                <strong>{r.done ? 'Uncovered!' : `${r.pct}% uncovered`}</strong>
              </p>
              {!r.done && (
                <p>
                  {r.moves ? (
                    <>
                      <strong>{r.moves}</strong> {r.moves === 1 ? 'move' : 'moves'} for you ·{' '}
                      <button type="button" className="link small" onClick={play}>
                        Play
                      </button>
                    </>
                  ) : (
                    <span className="muted">No moves yet: meet a goal for more.</span>
                  )}
                </p>
              )}
              <p className="muted">
                {r.total} family sparks
                {r.status.next ? ` · ${r.status.next.title} in ${r.status.next.toGo}` : ''}
              </p>
            </div>
          </div>
        ))}
    </div>
  )
}
