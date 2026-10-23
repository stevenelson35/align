import { useRef, useState } from 'react'
import { addImage as saveImage } from '../../firebase/db'
import { useApp } from '../../hooks/useApp'
import { photoUrl } from '../../photos/favorites'
import { isStoredImage, storedImageRef } from '../../utils/pictures'
import { MAX_IMAGES, MAX_LINKS, type Details, type LinkItem } from '../../utils/details'
import type { StoredLink } from '../../types'
import { linkLabel, safeUrl } from '../../utils/links'
import { PhotoPicker } from '../Photos/PhotoPicker'
import { Icon } from './Icon'
import { Picture, PictureLightbox } from './Picture'
import { PictureEditor } from './PictureEditor'
import { AutoTextarea } from './AutoTextarea'

/**
 * Links and pictures, editable: a box per link with ✕ and "+ Add link"; picture thumbnails with ✕, plus Add a
 * picture (the phone's own picker, then crop / rotate, stored in Align: images/{id}), From favorites (psort's
 * published photos) and Paste an address.
 */
export function LinksAndPictures({
  value,
  onChange,
  onError,
  linkHint = 'Address (e.g. example.com/menu)',
}: {
  value: Pick<Details, 'links' | 'images'>
  onChange: (d: Pick<Details, 'links' | 'images'>) => void
  onError: (message: string) => void
  linkHint?: string
}) {
  const { uid } = useApp()
  const [picking, setPicking] = useState(false)
  const [pasted, setPasted] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const links = value.links
  const setLinks = (next: LinkItem[]) => onChange({ ...value, links: next })
  const setLink = (i: number, patch: Partial<LinkItem>) => setLinks(links.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const addImage = (url: string) => onChange({ ...value, images: [...value.images.filter((u) => u !== url), url] })
  const fullOfImages = value.images.length >= MAX_IMAGES

  return (
    <div className="links-pictures">
      <div>
        <span className="label">Links</span>
        {links.map((l, i) => (
          <div key={i} className="detail-link-edit">
            <div className="grow detail-link-fields">
              <input
                value={l.label}
                autoFocus={!l.url && !l.label && i === links.length - 1}
                onChange={(e) => setLink(i, { label: e.target.value })}
                placeholder="Name (e.g. Menu)"
                maxLength={200}
                aria-label={`Link ${i + 1} name`}
              />
              <input
                type="text"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                value={l.url}
                onChange={(e) => setLink(i, { url: e.target.value })}
                placeholder={linkHint}
                aria-label={`Link ${i + 1} address`}
              />
            </div>
            <button type="button" className="link small" onClick={() => setLinks(links.filter((_, j) => j !== i))} aria-label={`Remove link ${i + 1}`}>
              <Icon name="close" />
            </button>
          </div>
        ))}
        {links.length < MAX_LINKS && (
          <button type="button" className="secondary small" onClick={() => setLinks([...links, { url: '', label: '' }])}>
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
                <Picture src={u} alt={`Picture ${i + 1}`} />
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
              <button type="button" className="secondary small" onClick={() => fileInput.current?.click()}>
                <Icon name="camera" /> + Add a picture
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null)
                  e.target.value = '' // the same file can be chosen again
                }}
              />
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
        {file && (
          <PictureEditor
            file={file}
            onCancel={() => setFile(null)}
            onDone={(p) => {
              setFile(null)
              const { id, written } = saveImage(p.data, p.width, p.height, uid)
              written.catch((err) => onError(`The picture wasn’t saved: ${err instanceof Error ? err.message : String(err)}`))
              addImage(storedImageRef(id))
            }}
          />
        )}
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
        <AutoTextarea rows={3} value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} maxLength={5000} />
      </label>
      <LinksAndPictures value={value} onChange={(d) => onChange({ ...value, ...d })} onError={onError} linkHint={linkHint} />
    </>
  )
}

/** Shows whichever details there are: the note, each link, and the pictures (tap one to see it full screen). */
export function DetailsView({ note, links, images, alt }: Partial<Details> & { alt: string }) {
  const [open, setOpen] = useState<string | null>(null)
  const [showAddresses, setShowAddresses] = useState(false)
  const safeLinks = (links ?? []).map((l) => ({ ...l, href: safeUrl(l.url) })).filter((l) => l.href)
  const pictures = (images ?? []).filter((u) => isStoredImage(u) || safeUrl(u))
  const altFor = (i: number) => (pictures.length > 1 ? `${alt} (${i + 1})` : alt)
  return (
    <>
      {note && <p className="entry-note">{note}</p>}
      {safeLinks.length > 0 && (
        <div className="detail-links-wrap">
          <ul className="detail-links">
            {safeLinks.map((l) => (
              <li key={l.url}>
                <a href={l.href!} target="_blank" rel="noopener noreferrer">
                  <Icon name="link" /> <span>{l.label || linkLabel(l.url)}</span>
                </a>
                {showAddresses && <span className="muted small detail-link-address">{l.url}</span>}
              </li>
            ))}
          </ul>
          <button type="button" className="link small" onClick={() => setShowAddresses(!showAddresses)}>
            {showAddresses ? 'Hide addresses' : safeLinks.length > 1 ? 'Show addresses' : 'Show address'}
          </button>
        </div>
      )}
      {pictures.length > 0 && (
        <div className={`detail-pictures${pictures.length === 1 ? ' single' : ''}`}>
          {pictures.map((u, i) => (
            <button key={u} type="button" className="picture-button" onClick={() => setOpen(u)} aria-label={`Show ${altFor(i)} full screen`}>
              <Picture src={u} alt={altFor(i)} className="item-picture" />
            </button>
          ))}
        </div>
      )}
      {open && <PictureLightbox src={open} alt={alt} onClose={() => setOpen(null)} />}
    </>
  )
}

/** Small marks on a row when it has more links or pictures (the same on every kind of entry). */
export function DetailsMarks({ links = [], images = [] }: { links?: StoredLink[]; images?: string[] }) {
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
