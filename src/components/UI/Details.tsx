import { useState } from 'react'
import { chooseImage } from '../../blog/cloudinary'
import { photoUrl } from '../../photos/favorites'
import { MAX_IMAGES, MAX_LINKS, type Details } from '../../utils/details'
import { linkLabel, safeUrl } from '../../utils/links'
import { PhotoPicker } from '../Photos/PhotoPicker'
import { Icon } from './Icon'

/**
 * Links and pictures, editable: a box per link with ✕ and "+ Add link"; picture thumbnails with ✕, plus Upload
 * (the Cloudinary widget), From favorites (psort's published photos) and Paste an address.
 */
export function LinksAndPictures({
  value,
  onChange,
  onError,
  linkHint = 'e.g. a menu, receipt or article',
}: {
  value: Pick<Details, 'links' | 'images'>
  onChange: (d: Pick<Details, 'links' | 'images'>) => void
  onError: (message: string) => void
  linkHint?: string
}) {
  const [picking, setPicking] = useState(false)
  const [pasted, setPasted] = useState('')
  const links = value.links.length ? value.links : []
  const setLinks = (next: string[]) => onChange({ ...value, links: next })
  const addImage = (url: string) => onChange({ ...value, images: [...value.images.filter((u) => u !== url), url] })
  const fullOfImages = value.images.length >= MAX_IMAGES

  return (
    <div className="links-pictures">
      <div>
        <span className="label">Links</span>
        {links.map((u, i) => (
          <div key={i} className="row detail-link-row">
            <input
              type="text"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              className="grow"
              value={u}
              autoFocus={u === '' && i === links.length - 1}
              onChange={(e) => setLinks(links.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={linkHint}
              aria-label={`Link ${i + 1}`}
            />
            <button type="button" className="link small" onClick={() => setLinks(links.filter((_, j) => j !== i))} aria-label={`Remove link ${i + 1}`}>
              <Icon name="close" />
            </button>
          </div>
        ))}
        {links.length < MAX_LINKS && (
          <button type="button" className="secondary small" onClick={() => setLinks([...links, ''])}>
            + Add link
          </button>
        )}
      </div>
      <div>
        <span className="label">Pictures</span>
        {value.images.length > 0 && (
          <div className="picture-thumbs">
            {value.images.map((u, i) => (
              <span key={u} className="picture-thumb">
                <img src={u} alt={`Picture ${i + 1}`} loading="lazy" />
                <button type="button" className="thumb-remove" onClick={() => onChange({ ...value, images: value.images.filter((x) => x !== u) })} aria-label={`Remove picture ${i + 1}`}>
                  <Icon name="close" />
                </button>
              </span>
            ))}
          </div>
        )}
        {!fullOfImages && (
          <>
            <div className="row wrap">
              <button type="button" className="secondary small" onClick={() => chooseImage(({ url }) => addImage(url)).catch((err) => onError(String(err.message ?? err)))}>
                <Icon name="camera" /> + Upload
              </button>
              <button type="button" className="secondary small" onClick={() => setPicking(true)}>
                <Icon name="photo" /> + From favorites
              </button>
            </div>
            <div className="row">
              <input
                type="text"
                inputMode="url"
                autoCapitalize="off"
                className="grow"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="…or paste a picture's address"
                aria-label="Picture address"
              />
              <button
                type="button"
                className="secondary small"
                disabled={!pasted.trim()}
                onClick={() => {
                  const u = safeUrl(pasted)
                  if (!u) return onError('That doesn’t look like a web address.')
                  addImage(u)
                  setPasted('')
                }}
              >
                Add
              </button>
            </div>
          </>
        )}
        {picking && <PhotoPicker onPick={(p) => addImage(photoUrl(p.id, 1024))} onClose={() => setPicking(false)} />}
      </div>
    </div>
  )
}

/** A note plus links and pictures: the whole details editor (voting items, goal entries). */
export function DetailsFields({
  value,
  onChange,
  onError,
  linkHint,
}: {
  value: Details
  onChange: (d: Details) => void
  onError: (message: string) => void
  linkHint?: string
}) {
  return (
    <>
      <label>
        Note
        <textarea rows={3} value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} maxLength={5000} />
      </label>
      <LinksAndPictures value={value} onChange={(d) => onChange({ ...value, ...d })} onError={onError} linkHint={linkHint} />
    </>
  )
}

/** Shows whichever details there are: the note, each link, and the pictures (tap for full size). */
export function DetailsView({ note, links, images, alt }: Partial<Details> & { alt: string }) {
  const safeLinks = (links ?? []).map((u) => [u, safeUrl(u)] as const).filter(([, s]) => s)
  const safeImages = (images ?? []).map((u) => safeUrl(u)).filter((u): u is string => !!u)
  return (
    <>
      {note && <p className="item-note">{note}</p>}
      {safeLinks.length > 0 && (
        <ul className="detail-links">
          {safeLinks.map(([u, s]) => (
            <li key={u}>
              <a href={s!} target="_blank" rel="noopener noreferrer">
                <Icon name="link" /> {linkLabel(u)} ↗
              </a>
            </li>
          ))}
        </ul>
      )}
      {safeImages.length > 0 && (
        <div className={`detail-pictures${safeImages.length === 1 ? ' single' : ''}`}>
          {safeImages.map((u, i) => (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer">
              <img src={u} alt={safeImages.length > 1 ? `${alt} (${i + 1})` : alt} className="item-picture" loading="lazy" />
            </a>
          ))}
        </div>
      )}
    </>
  )
}

/** Small marks on a row when it has more links or pictures (the same on every kind of entry). */
export function DetailsMarks({ links = [], images = [] }: { links?: string[]; images?: string[] }) {
  if (!links.length && !images.length) return null
  return (
    <span className="details-marks muted small">
      {links.length > 0 && (
        <span title={`${links.length} link${links.length > 1 ? 's' : ''}`}>
          {' '}
          <Icon name="link" />
          {links.length > 1 && links.length}
        </span>
      )}
      {images.length > 0 && (
        <span title={`${images.length} picture${images.length > 1 ? 's' : ''}`}>
          {' '}
          <Icon name="photo" />
          {images.length > 1 && images.length}
        </span>
      )}
    </span>
  )
}
