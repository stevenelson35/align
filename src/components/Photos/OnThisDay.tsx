import { useState } from 'react'
import { useFavorites } from '../../hooks/useFavorites'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { onThisDay, photoCaption, photoUrl, yearsAgo, type Favorite } from '../../photos/favorites'
import { Icon } from '../UI/Icon'
import { PhotoViewer } from './PhotoViewer'

/** "On this day": favorites taken on this date in earlier years, on the day view. Hidden when there are none. */
export function OnThisDay({ day }: { day: string }) {
  const { manifest } = useFavorites()
  const [hidden, setHidden] = useStoredFlag('align-on-this-day-hidden', false)
  const [open, setOpen] = useState<Favorite | null>(null)
  const photos = manifest ? onThisDay(manifest.photos, day) : []
  if (!photos.length) return null // also while loading, or if the list can't be reached: it's a nice extra
  return (
    <div className="on-this-day">
      <h3>
        <Icon name="photo" /> On this day <span className="muted">{photos.length}</span>
        <button type="button" className="link small" onClick={() => setHidden(!hidden)}>
          {hidden ? 'Show' : 'Hide'}
        </button>
      </h3>
      {!hidden && (
        <div className="photo-strip">
          {photos.map((p) => (
            <button key={p.id} type="button" className="photo-cell" onClick={() => setOpen(p)} title={photoCaption(p)}>
              <img src={photoUrl(p.id, 640)} alt={photoCaption(p)} loading="lazy" />
              <span className="photo-years">{yearsAgo(p, day) === 1 ? '1 year ago' : `${yearsAgo(p, day)} years ago`}</span>
            </button>
          ))}
        </div>
      )}
      {open && <PhotoViewer photo={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
