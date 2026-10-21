import type { Favorite } from '../../photos/favorites'
import { Icon } from '../UI/Icon'
import { PhotoGrid } from './PhotoGrid'

/** Choose one of the favorites (blog posts, goal entries, voting items). */
export function PhotoPicker({ onPick, onClose }: { onPick: (p: Favorite) => void; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal photo-modal" role="dialog" aria-label="Choose a favorite photo" onClick={(e) => e.stopPropagation()}>
        <header className="row">
          <h2 className="grow">
            <Icon name="photo" /> Favorites
          </h2>
          <button type="button" className="link" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <PhotoGrid
          autoFocus
          onChoose={(p) => {
            onPick(p)
            onClose()
          }}
        />
      </div>
    </div>
  )
}
