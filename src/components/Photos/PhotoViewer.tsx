import { photoCaption, photoUrl, type Favorite } from '../../photos/favorites'
import { TextForm } from '../Tasks/TextAbout'
import { Icon } from '../UI/Icon'

/** One favorite, larger: its date and people, the full-size copy, and "Text this photo" (sends the image's link). */
export function PhotoViewer({ photo, onClose }: { photo: Favorite; onClose: () => void }) {
  const caption = photoCaption(photo)
  const full = photoUrl(photo.id, 2048)
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal photo-modal" role="dialog" aria-label={caption} onClick={(e) => e.stopPropagation()}>
        <header className="row">
          <h2 className="grow photo-title">{caption}</h2>
          <button type="button" className="link" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <img className="photo-large" src={photoUrl(photo.id, 1024)} alt={caption} />
        <div className="row">
          <a className="button-link small" href={full} target="_blank" rel="noopener noreferrer">
            Full size <Icon name="external" />
          </a>
        </div>
        <TextForm key={photo.id} subject={{ title: caption, when: '', link: full }} startOpen={false} label="Text this photo" />
      </div>
    </div>
  )
}
