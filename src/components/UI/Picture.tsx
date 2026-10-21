import { useEffect, useState } from 'react'
import { imageData } from '../../firebase/db'
import { safeUrl } from '../../utils/links'
import { isStoredImage, storedImageId } from '../../utils/pictures'
import { Icon } from './Icon'

/** A picture from an entry's `images`: a stored one ("align-image:<id>", loaded from Firestore) or an address. */
export function Picture({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const stored = isStoredImage(src)
  const [loaded, setLoaded] = useState<{ src: string; url: string | null } | null>(null)
  useEffect(() => {
    if (!stored) return
    let live = true
    imageData(storedImageId(src))
      .then((url) => live && setLoaded({ src, url }))
      .catch(() => live && setLoaded({ src, url: null }))
    return () => {
      live = false
    }
  }, [src, stored])
  const url = stored ? (loaded?.src === src ? loaded.url : undefined) : safeUrl(src)
  if (url === undefined) return <span className={`picture-loading ${className ?? ''}`} role="img" aria-label={`${alt} (loading)`} />
  if (url === null) {
    return (
      <span className={`picture-missing ${className ?? ''}`} role="img" aria-label={`${alt} (missing)`} title="This picture isn't available">
        <Icon name="photo" />
      </span>
    )
  }
  return <img src={url} alt={alt} className={className} loading="lazy" />
}

/** A picture filling the screen (tap outside or ✕ to close); addresses also offer opening in a new tab. */
export function PictureLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const address = isStoredImage(src) ? null : safeUrl(src)
  return (
    <div className="modal-backdrop lightbox" onClick={onClose} role="dialog" aria-label={alt}>
      <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <div className="row lightbox-bar">
          <span className="grow" />
          {address && (
            <a className="button-link small" href={address} target="_blank" rel="noopener noreferrer">
              Open <Icon name="external" />
            </a>
          )}
          <button type="button" className="secondary small" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <Picture src={src} alt={alt} className="lightbox-picture" />
      </div>
    </div>
  )
}
