import { useEffect, useState } from 'react'
import { useApp } from '../../hooks/useApp'
import { useFavorites } from '../../hooks/useFavorites'
import { useRewards } from '../../hooks/useRewards'
import { photoUrl } from '../../photos/favorites'
import { celebrate } from '../../utils/celebrate'
import { people } from '../../utils/tasks'

const SEEN = 'align-reveal-seen'
const keyOf = (r: { photoId: string; startedAt: string }) => `${r.photoId}|${r.startedAt}`

/**
 * When the last ice breaks: the photo, clear at last, slowly settling in; when and where it was taken; who broke how
 * much (everyone's color, no ranking); sparkles. Shown once on each device, whoever broke the last of it.
 */
export function RevealFinale() {
  const app = useApp()
  const r = useRewards()
  const { manifest } = useFavorites()
  const [seen, setSeen] = useState(() => localStorage.getItem(SEEN))
  const [error, setError] = useState<string | null>(null)
  const show = !!r.reveal && r.done && seen !== keyOf(r.reveal)
  useEffect(() => {
    if (show) setTimeout(() => celebrate({ done: 1, total: 1, quiet: true }), 900)
  }, [show])
  if (!show || !r.reveal) return null
  const reveal = r.reveal
  const close = () => {
    localStorage.setItem(SEEN, keyOf(reveal))
    setSeen(keyOf(reveal))
  }
  const photo = manifest?.photos.find((p) => p.id === reveal.photoId)
  const event = photo?.event ? manifest?.events.find((e) => e.slug === photo.event)?.name : undefined
  const when = photo?.taken_at ? new Date(photo.taken_at).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }) : undefined
  const total = Object.values(reveal.by ?? {}).reduce((a, b) => a + b, 0)
  const who = people(app.household, true).filter(([uid]) => (reveal.by?.[uid] ?? 0) > 0)
  return (
    <div className="reveal-finale" role="dialog" aria-label="The picture is uncovered">
      <div className="reveal-finale-card">
        <img src={photoUrl(reveal.photoId, 1600)} alt={event ? `From ${event}` : 'A family photo'} className="reveal-finale-photo" />
        <h2>Uncovered together</h2>
        {(event || when) && <p className="muted">{[event, when].filter(Boolean).join(' · ')}</p>}
        {total > 0 && (
          <div className="reveal-share" aria-label="Who broke the ice">
            {who.map(([uid, m]) => (
              <span key={uid} style={{ flexGrow: reveal.by[uid], background: m.color }} title={`${m.displayName}: ${reveal.by[uid]}`} />
            ))}
          </div>
        )}
        {who.length > 0 && <p className="small muted">{who.map(([, m]) => m.displayName).join(', ')}</p>}
        <div className="row">
          <button
            type="button"
            className="small"
            onClick={() => {
              close()
              r.startNext().catch((err) => setError(err instanceof Error ? err.message : String(err)))
            }}
          >
            Start the next one
          </button>
          <button type="button" className="secondary small" onClick={close}>
            Close
          </button>
        </div>
        {error && <p className="error small">{error}</p>}
      </div>
    </div>
  )
}
