// Pictures stored in Align (DESIGN.md §5.7): chosen with the phone's own picker, cropped / rotated in the browser,
// shrunk to a JPEG under Firestore's 1 MB document limit, and saved in `images/{id}`. Entries keep
// "align-image:<id>" in their `images` list beside ordinary addresses (favorites, older Cloudinary uploads).

export const IMAGE_REF = 'align-image:'
/** Longest side of a stored picture: sharp on a phone or laptop, small enough to store. */
export const MAX_SIDE = 1600
/** Keep the data well under the 1 MB document limit (the rules allow up to 1,000,000 characters). */
export const MAX_DATA = 900_000

export const isStoredImage = (src: string) => src.startsWith(IMAGE_REF)
export const storedImageId = (src: string) => src.slice(IMAGE_REF.length)
export const storedImageRef = (id: string) => `${IMAGE_REF}${id}`

/** Crop shapes: width ÷ height, or null to keep the picture's own shape. */
export const ASPECTS: { label: string; value: number | null }[] = [
  { label: 'Original', value: null },
  { label: 'Square', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
]

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * The part of a `sw` × `sh` picture to keep: the largest rectangle of `aspect` that fits, made smaller by `zoom`
 * (1 = as large as fits), centered and then moved by (`dx`, `dy`) picture pixels, never past the edges.
 */
export function cropRect(sw: number, sh: number, aspect: number | null, zoom: number, dx: number, dy: number): Rect {
  const a = aspect ?? sw / sh
  let w = sw
  let h = sw / a
  if (h > sh) {
    h = sh
    w = sh * a
  }
  const z = Math.max(1, zoom)
  w /= z
  h /= z
  const x = Math.min(Math.max((sw - w) / 2 + dx, 0), sw - w)
  const y = Math.min(Math.max((sh - h) / 2 + dy, 0), sh - h)
  return { x, y, w, h }
}

/** A size no bigger than `max` on its longest side, keeping the shape (whole pixels). */
export function fitWithin(w: number, h: number, max: number): { w: number; h: number } {
  const s = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) }
}
