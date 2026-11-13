import { useRef, type TouchEvent } from 'react'
import { photoCaption, photoUrl, type Favorite } from '../../photos/favorites'
import { photoSwipeDirection } from '../../photos/swipe'
import { TextForm } from '../Tasks/TextAbout'
import { Icon } from '../UI/Icon'

/** One favorite, larger: its date and people, the full-size copy, and "Text this photo" (sends the image's link). */
export function PhotoViewer({ photo, onClose, navigation }: {
  photo: Favorite
  onClose: () => void
  navigation?: { index: number; total: number; onPrevious?: () => void; onNext?: () => void }
}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const caption = photoCaption(photo)
  const full = photoUrl(photo.id, 2048)
  function startSwipe(event: TouchEvent<HTMLImageElement>) {
    const touch = event.touches.length === 1 ? event.touches[0] : null
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null
  }
  function endSwipe(event: TouchEvent<HTMLImageElement>) {
    const start = touchStart.current
    touchStart.current = null
    if (!start || event.touches.length || event.changedTouches.length !== 1) return
    const dx = event.changedTouches[0].clientX - start.x
    const dy = event.changedTouches[0].clientY - start.y
    const direction = photoSwipeDirection(dx, dy)
    if (direction === 1) navigation?.onNext?.()
    else if (direction === -1) navigation?.onPrevious?.()
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal photo-modal" role="dialog" aria-label={caption} onClick={(e) => e.stopPropagation()}>
        <header className="row">
          <h2 className="grow photo-title">{caption}</h2>
          <button type="button" className="link" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <img
          className={`photo-large${navigation ? ' photo-swipe' : ''}`}
          src={photoUrl(photo.id, 1024)}
          alt={caption}
          onTouchStart={navigation ? startSwipe : undefined}
          onTouchEnd={navigation ? endSwipe : undefined}
          onTouchCancel={() => { touchStart.current = null }}
        />
        {navigation && navigation.total > 1 && (
          <div className="photo-navigation" aria-label="Photo navigation">
            <button type="button" className="secondary small" onClick={navigation.onPrevious} disabled={!navigation.onPrevious}>Previous</button>
            <span className="muted small" aria-live="polite">{navigation.index + 1} of {navigation.total}</span>
            <button type="button" className="secondary small" onClick={navigation.onNext} disabled={!navigation.onNext}>Next</button>
          </div>
        )}
        <div className="row">
          <a className="button-link small" href={full} target="_blank" rel="noopener noreferrer">
            Full size <Icon name="external" />
          </a>
        </div>
        <TextForm key={photo.id} subject={{ title: caption, when: '', link: full }} startOpen={false} label="Send this photo" kind="photo" />
      </div>
    </div>
  )
}
