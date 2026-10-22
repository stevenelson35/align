import { useState } from 'react'
import { PHOTO_BROWSER_URL, type Favorite } from '../../photos/favorites'
import { Icon } from '../UI/Icon'
import { PhotoGrid } from './PhotoGrid'
import { PhotoViewer } from './PhotoViewer'
import { HelpTip } from '../UI/HelpTip'

/** #/photos: the favorites psort publishes, to look through and text. The blog's browser filters by person and event. */
export function PhotosView() {
  const [open, setOpen] = useState<Favorite | null>(null)
  return (
    <section>
      <header className="view-header">
        <h2>
          <Icon name="photo" /> Photos
        </h2>
        <HelpTip topic="photos" />
        <span className="grow" />
        <a className="button-link small" href={PHOTO_BROWSER_URL} target="_blank" rel="noopener noreferrer">
          Blog photo browser <Icon name="external" />
        </a>
      </header>
      <p className="muted small">Favorites from the photo library. Tap one to see it larger or text it to someone.</p>
      <PhotoGrid onChoose={setOpen} />
      {open && <PhotoViewer photo={open} onClose={() => setOpen(null)} />}
    </section>
  )
}
