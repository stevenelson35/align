import { photoUrl, type PhotoSize } from '../../photos/favorites'

/** An SVG mask of the clear cells (one unit square each), for showing the sharp photo only there. */
function clearMask(left: number[], cols: number, rows: number): string {
  const rects = left.map((n, i) => (n === 0 ? `<rect x='${i % cols}' y='${Math.floor(i / cols)}' width='1.02' height='1.02'/>` : '')).join('')
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${cols} ${rows}' preserveAspectRatio='none'>${rects}</svg>`)}")`
}

/**
 * The hidden photo under a grid of frosted ice. Underneath is a heavily blurred copy (only colors show through);
 * the sharp photo shows only in cells whose ice is broken (an SVG mask, so no browser blur effects are needed); frost
 * sits on top of the rest, thicker where more hits are needed and cracked once hit. `breaking` cells flash as a move
 * hits them (and shatter if that was their last layer).
 */
export function IcePicture({ photoId, cols, rows, left, thick, breaking, size = 1024, className = '' }: { photoId: string; cols: number; rows: number; left: number[]; thick: number; breaking?: Set<number>; size?: PhotoSize; className?: string }) {
  const clear = left.filter((n) => n === 0).length
  const image = `url("${photoUrl(photoId, size)}")`
  const mask = clear ? clearMask(left, cols, rows) : undefined
  return (
    <div className={`ice-picture ${className}`} style={{ aspectRatio: `${cols} / ${rows}` }} role="img" aria-label={`A hidden picture, ${Math.round((clear / (cols * rows)) * 100)}% uncovered`}>
      <div className="ice-blur" style={{ backgroundImage: image }} />
      {mask && <div className="ice-clear" style={{ backgroundImage: image, maskImage: mask, WebkitMaskImage: mask }} />}
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
