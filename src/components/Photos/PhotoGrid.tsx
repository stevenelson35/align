import { useState } from 'react'
import { useFavorites } from '../../hooks/useFavorites'
import { matchesSearch, photoCaption, photoUrl, type Favorite } from '../../photos/favorites'

const PAGE = 60

/** Favorites as a searchable grid of thumbnails, newest first. Tapping one calls `onChoose`. */
export function PhotoGrid({ onChoose, autoFocus = false }: { onChoose: (p: Favorite) => void; autoFocus?: boolean }) {
  const { manifest, error } = useFavorites()
  const [query, setQuery] = useState('')
  const [topOnly, setTopOnly] = useState(false)
  const [shown, setShown] = useState(PAGE)
  if (error) return <p className="error">{error}</p>
  if (!manifest) return <p className="muted">Loading photos…</p>
  const hasTop = manifest.photos.some((p) => p.top)
  const found = manifest.photos.filter((p) => (!topOnly || p.top) && matchesSearch(p, query))
  return (
    <div className="photo-grid-wrap">
      <div className="row">
        <input
          type="search"
          className="grow"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value)
            setShown(PAGE)
          }}
          placeholder="Search: names, years, events"
          aria-label="Search photos"
        />
        {hasTop && (
          <label className="inline small">
            <input type="checkbox" checked={topOnly} onChange={(e) => setTopOnly(e.target.checked)} /> Top picks
          </label>
        )}
      </div>
      <p className="muted small">
        {found.length} of {manifest.photos.length} favorites
      </p>
      <div className="photo-grid">
        {found.slice(0, shown).map((p) => (
          <button key={p.id} type="button" className="photo-cell" onClick={() => onChoose(p)} title={photoCaption(p)}>
            <img src={photoUrl(p.id, 640)} alt={photoCaption(p)} loading="lazy" />
          </button>
        ))}
      </div>
      {found.length > shown && (
        <button type="button" className="secondary small" onClick={() => setShown(shown + PAGE)}>
          Show more
        </button>
      )}
    </div>
  )
}
