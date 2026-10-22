import { useState } from 'react'
import { useFavorites } from '../../hooks/useFavorites'
import { useDailyFlag } from '../../hooks/useDailyFlag'
import { photoCaption, photoDate, photosForDay, photoUrl, yearsAgo, type Favorite } from '../../photos/favorites'
import { PhotoViewer } from './PhotoViewer'
import { SectionHeader } from '../UI/SectionHeader'

/**
 * "On this day": favorites taken on this date in earlier years, on the day view. With none, the nearest date within
 * a week ("Near this day"), or else a few from the archive (the same pick all day).
 */
export function OnThisDay({ day }: { day: string }) {
  const { manifest } = useFavorites()
  // Shown each morning; Hide lasts for the rest of the day.
  const [hidden, setHidden] = useDailyFlag('align-on-this-day-hidden', false)
  const [open, setOpen] = useState<Favorite | null>(null)
  const found = manifest ? photosForDay(manifest.photos, day) : null
  const photos = found?.photos ?? []
  if (!photos.length) return null // while loading, or if the list can't be reached: it's a nice extra
  const title = found!.kind === 'same' ? 'On this day' : found!.kind === 'near' ? 'Near this day' : 'From the archive'
  const label = (p: Favorite) => {
    const ago = yearsAgo(p, day) === 1 ? '1 year ago' : `${yearsAgo(p, day)} years ago`
    return found!.kind === 'same' ? ago : found!.kind === 'near' ? photoDate(p).replace(/, \d{4}$/, '') + ` · ${ago}` : photoDate(p)
  }
  return (
    <div className="day-section on-this-day">
      <SectionHeader icon="photo" title={title} count={photos.length} onTitleClick={() => setHidden(!hidden)} expanded={!hidden}>
        <button type="button" className="link small" onClick={() => setHidden(!hidden)} aria-expanded={!hidden}>
          {hidden ? 'Show' : 'Hide'}
        </button>
      </SectionHeader>
      {!hidden && (
        <div className="photo-strip">
          {photos.map((p) => (
            <button key={p.id} type="button" className="photo-cell" onClick={() => setOpen(p)} title={photoCaption(p)}>
              <img src={photoUrl(p.id, 640)} alt={photoCaption(p)} loading="lazy" />
              <span className="photo-years">{label(p)}</span>
            </button>
          ))}
        </div>
      )}
      {open && <PhotoViewer photo={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
