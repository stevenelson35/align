import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { ASPECTS, cropRect, fitWithin, MAX_DATA, MAX_SIDE } from '../../utils/pictures'
import { Icon } from './Icon'

/** Working copy size: big enough to crop from, small enough for a phone's memory. */
const WORK_SIDE = 2400

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img) // the browser applies the photo's orientation (EXIF) when drawing
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file isn’t a picture this browser can open (try a JPEG or PNG).'))
    }
    img.src = url
  })
}

/** The picture, rotated by quarter turns, on a canvas no bigger than WORK_SIDE. */
function workingCanvas(img: HTMLImageElement, turns: number): HTMLCanvasElement {
  const { w, h } = fitWithin(img.naturalWidth, img.naturalHeight, WORK_SIDE)
  const sideways = turns % 2 === 1
  const c = document.createElement('canvas')
  c.width = sideways ? h : w
  c.height = sideways ? w : h
  const ctx = c.getContext('2d')!
  ctx.translate(c.width / 2, c.height / 2)
  ctx.rotate((turns * Math.PI) / 2)
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  return c
}

/** The kept part as a JPEG data URL under MAX_DATA characters (lower quality, then smaller, until it fits). */
function encode(source: HTMLCanvasElement, r: { x: number; y: number; w: number; h: number }): { data: string; width: number; height: number } {
  let { w, h } = fitWithin(r.w, r.h, MAX_SIDE)
  for (;;) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff' // transparent PNGs get a white background in JPEG
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(source, r.x, r.y, r.w, r.h, 0, 0, w, h)
    for (const q of [0.85, 0.75, 0.65]) {
      const data = c.toDataURL('image/jpeg', q)
      if (data.length <= MAX_DATA) return { data, width: w, height: h }
    }
    w = Math.round(w * 0.8)
    h = Math.round(h * 0.8)
  }
}

/**
 * Crop and rotate a chosen picture before it's saved: pick a shape (Original keeps the whole picture), drag to
 * position, zoom with the slider, ↻ to rotate. Done hands back a JPEG data URL sized for storing.
 */
export function PictureEditor({ file, onDone, onCancel }: { file: File; onDone: (p: { data: string; width: number; height: number }) => void; onCancel: () => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [turns, setTurns] = useState(0)
  const [aspect, setAspect] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ dx: 0, dy: 0 })
  const [busy, setBusy] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null)

  useEffect(() => {
    let live = true
    loadImage(file)
      .then((i) => live && setImg(i))
      .catch((err) => live && setError(err.message))
    return () => {
      live = false
    }
  }, [file])
  useEffect(() => () => void (img && URL.revokeObjectURL(img.src)), [img])

  const work = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null)
  const source = () => {
    if (!img) return null
    const key = `${img.src}:${turns}`
    if (work.current?.key !== key) work.current = { key, canvas: workingCanvas(img, turns) }
    return work.current.canvas
  }
  const rect = () => {
    const s = source()
    return s ? cropRect(s.width, s.height, aspect, zoom, offset.dx, offset.dy) : null
  }

  // Draw the preview: exactly the part that will be kept.
  useEffect(() => {
    const s = source()
    const r = rect()
    const c = canvasRef.current
    if (!s || !r || !c) return
    const width = c.clientWidth || 320
    c.width = width * devicePixelRatio
    c.height = (width * r.h * devicePixelRatio) / r.w
    c.getContext('2d')!.drawImage(s, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height)
  })

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, ...offset }
  }
  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    const r = rect()
    const s = source()
    if (!drag.current || !r || !s) return
    const scale = r.w / e.currentTarget.clientWidth // picture pixels per screen pixel
    const dx = drag.current.dx - (e.clientX - drag.current.x) * scale
    const dy = drag.current.dy - (e.clientY - drag.current.y) * scale
    // Keep the stored offset inside what cropRect allows, so dragging back responds at once.
    const maxX = (s.width - r.w) / 2
    const maxY = (s.height - r.h) / 2
    setOffset({ dx: Math.max(-maxX, Math.min(maxX, dx)), dy: Math.max(-maxY, Math.min(maxY, dy)) })
  }

  function done() {
    const s = source()
    const r = rect()
    if (!s || !r) return
    setBusy(true)
    // Let the "Saving…" label paint before the (brief) encoding work.
    setTimeout(() => onDone(encode(s, r)), 30)
  }

  const reset = () => setOffset({ dx: 0, dy: 0 })
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="card modal picture-editor" role="dialog" aria-label="Crop the picture" onClick={(e) => e.stopPropagation()}>
        <header className="row">
          <h2 className="grow">Picture</h2>
          <button type="button" className="link" onClick={onCancel} aria-label="Cancel">
            ✕
          </button>
        </header>
        {error && <p className="error">{error}</p>}
        {!img && !error && <p className="muted">Opening…</p>}
        {img && (
          <>
            <canvas
              ref={canvasRef}
              className={`editor-canvas${aspect !== null || zoom > 1 ? ' movable' : ''}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              aria-label="Preview: drag to position"
            />
            <div className="chips" role="group" aria-label="Shape">
              {ASPECTS.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  className={`small ${aspect === a.value ? '' : 'secondary'}`}
                  aria-pressed={aspect === a.value}
                  onClick={() => {
                    setAspect(a.value)
                    reset()
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <div className="row">
              <label className="grow inline small">
                Zoom
                <input type="range" min={1} max={4} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="grow" />
              </label>
              <button
                type="button"
                className="secondary small"
                onClick={() => {
                  setTurns((t) => (t + 1) % 4)
                  reset()
                }}
                aria-label="Rotate a quarter turn"
              >
                <Icon name="refresh" /> Rotate
              </button>
            </div>
            <p className="muted small">{aspect === null && zoom === 1 ? 'The whole picture is kept. Pick a shape or zoom to crop.' : 'Drag the picture to choose what’s kept.'}</p>
          </>
        )}
        <div className="row">
          <button type="button" onClick={done} disabled={!img || busy}>
            {busy ? 'Saving…' : 'Use picture'}
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
