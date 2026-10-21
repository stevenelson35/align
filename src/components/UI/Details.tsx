import { chooseImage } from '../../blog/cloudinary'
import { safeUrl } from '../../utils/links'
import type { DetailsDraft } from '../../utils/details'
import { Icon } from './Icon'

/**
 * The note / link / picture boxes. Pictures upload through the same Cloudinary widget as blog posts (anyone with
 * the image's long address can open it), or paste an image address.
 */
export function DetailsFields({
  value,
  onChange,
  onError,
  linkHint = 'e.g. a receipt, article or menu',
}: {
  value: DetailsDraft
  onChange: (d: DetailsDraft) => void
  onError: (message: string) => void
  linkHint?: string
}) {
  return (
    <>
      <label>
        Note
        <textarea rows={3} value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} maxLength={5000} />
      </label>
      <label>
        Link
        <input type="text" inputMode="url" autoCapitalize="off" value={value.url} onChange={(e) => onChange({ ...value, url: e.target.value })} placeholder={linkHint} />
      </label>
      <div>
        <span className="label">Picture</span>
        <div className="row">
          <button
            type="button"
            className="secondary small"
            onClick={() => chooseImage(({ url }) => onChange({ ...value, imageUrl: url })).catch((err) => onError(String(err.message ?? err)))}
          >
            <Icon name="camera" /> {value.imageUrl ? 'Change picture' : 'Upload picture'}
          </button>
          {value.imageUrl && (
            <button type="button" className="link small" onClick={() => onChange({ ...value, imageUrl: '' })}>
              Remove
            </button>
          )}
        </div>
        <input
          type="text"
          inputMode="url"
          autoCapitalize="off"
          value={value.imageUrl}
          onChange={(e) => onChange({ ...value, imageUrl: e.target.value })}
          placeholder="…or paste a picture's address"
          aria-label="Picture address"
        />
      </div>
    </>
  )
}

/** Shows whichever details are there. */
export function DetailsView({ note, url, imageUrl, alt }: { note?: string; url?: string; imageUrl?: string; alt: string }) {
  const link = safeUrl(url)
  const picture = safeUrl(imageUrl)
  return (
    <>
      {note && <p className="item-note">{note}</p>}
      {link && (
        <p className="small">
          <a href={link} target="_blank" rel="noopener noreferrer">
            {url} ↗
          </a>
        </p>
      )}
      {picture && (
        <a href={picture} target="_blank" rel="noopener noreferrer">
          <img src={picture} alt={alt} className="item-picture" loading="lazy" />
        </a>
      )}
    </>
  )
}
