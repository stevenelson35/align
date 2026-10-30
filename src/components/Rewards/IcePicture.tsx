import { photoUrl, type PhotoSize } from '../../photos/favorites'

/**
 * The hidden photo under a grid of frosted ice: blurry color shows through, thicker where more hits are needed,
 * cracked once partly broken; each broken cell shows its part clearly. `breaking` cells flash as a move hits them
 * (and shatter if that was their last layer).
 */
export function IcePicture({ photoId, cols, rows, left, thick, breaking, size = 1024, className = '' }: { photoId: string; cols: number; rows: number; left: number[]; thick: number; breaking?: Set<number>; size?: PhotoSize; className?: string }) {
  const clear = left.filter((n) => n === 0).length
  return (
    <div className={`ice-picture ${className}`} style={{ aspectRatio: `${cols} / ${rows}`, backgroundImage: `url("${photoUrl(photoId, size)}")` }} role="img" aria-label={`A hidden picture, ${Math.round((clear / (cols * rows)) * 100)}% uncovered`}>
      {left.map((n, i) =>
        n === 0 && !breaking?.has(i) ? null : (
          <span
            key={i}
            className={`ice l${Math.min(4, n)}${n > 0 && n < thick ? ' cracked' : ''}${breaking?.has(i) ? (n === 0 ? ' breaking' : ' hit') : ''}`}
            style={{ left: `${((i % cols) / cols) * 100}%`, top: `${(Math.floor(i / cols) / rows) * 100}%`, width: `${100 / cols}%`, height: `${100 / rows}%` }}
          />
        ),
      )}
    </div>
  )
}
