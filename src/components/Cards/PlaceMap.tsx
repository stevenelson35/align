import { useMemo } from 'react'
import { useShapes } from '../../hooks/useGeo'
import { continentFrame, LOWER_48, type GeoIndex, type Place } from '../../utils/geo'
import { frame, labelPoint, mainBox, projector, type Point } from '../../utils/topo'

const W = 400
const ASPECT = 4 / 3

/**
 * A flashcard's map. Hint (the front): the place filled in on its continent (or the lower 48), its neighbors
 * outlined, and no words, so it helps without giving the answer away. Answer (the back): zoomed in, labeled, with the
 * capital marked and the neighbors named. Tiny places get a ring so they can be found.
 */
export function PlaceMap({ place, mode, index }: { place: Place; mode: 'hint' | 'answer'; index: GeoIndex }) {
  const { set, error } = useShapes(place.kind)
  const drawn = useMemo(() => {
    const target = set?.byId.get(place.id)
    if (!set || !target) return null
    const country = place.kind === 'country' ? index.meta.countries[place.id] : undefined
    const label = (id: string): Point => {
      const c = place.kind === 'country' ? index.meta.countries[id] : undefined
      const s = set.byId.get(id)
      return c ? c.l : s ? labelPoint(s) : [0, 0]
    }
    const box = mainBox(target)
    const far = place.kind === 'state' && (place.id === '02' || place.id === '15') // Alaska, Hawaii
    const view =
      mode === 'hint'
        ? place.kind === 'country'
          ? frame(continentFrame(country?.c ?? '', country?.l ?? [0, 0]) ?? frame(box, 2, 30, ASPECT), 0.02, 0, ASPECT)
          : far
            ? frame(box, 1.2, 14, ASPECT)
            : frame(LOWER_48, 0.01, 0, ASPECT)
        : frame(box, place.kind === 'country' ? 0.9 : 0.55, place.kind === 'country' ? 8 : 3.5, ASPECT)
    const p = projector(view, W)
    const near = new Set(set.neighbors.get(place.id) ?? [])
    const paths = set.shapes.map((s, i) => ({ id: s.id, key: `${s.id}#${i}`, d: p.path(s), kind: s.id === place.id ? 'target' : near.has(s.id) ? 'neighbor' : 'land' })).filter((x) => x.d)
    // A ring round a place too small to see at this size.
    const [x0, y0] = p.point([box[0], box[3]])
    const [x1, y1] = p.point([box[2], box[1]])
    const tiny = Math.max(x1 - x0, y1 - y0) < 10 ? p.point(label(place.id)) : null

    const labels: { x: number; y: number; text: string; cls: string; size: number }[] = []
    let capital: Point | null = null
    if (mode === 'answer') {
      const taken: [number, number, number, number][] = []
      const place_ = (x: number, y: number, text: string, cls: string, size: number) => {
        const w = text.length * size * 0.56
        const b: [number, number, number, number] = [x - w / 2, y - size, x + w / 2, y + 2]
        if (b[0] < 2 || b[2] > W - 2 || b[1] < 2 || b[3] > p.height - 2) return false
        if (taken.some((t) => b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1])) return false
        taken.push(b)
        labels.push({ x, y, text, cls, size })
        return true
      }
      if (place.capital) {
        capital = p.point([place.capital.lon, place.capital.lat])
        taken.push([capital[0] - 5, capital[1] - 5, capital[0] + 5, capital[1] + 5])
      }
      const [tx, ty] = p.point(label(place.id))
      // The place's name, moved off the capital if they'd overlap.
      const name = place.kind === 'country' ? (country?.al[0] ?? place.name) : place.name
      // The capital's name under its dot (or above), then the place's name clear of both.
      if (capital && place.capital) {
        const c = capital
        if (!place_(c[0], c[1] + 16, place.capital.name, 'map-label-capital', 11.5)) place_(c[0], c[1] - 8, place.capital.name, 'map-label-capital', 11.5)
      }
      if (!place_(tx, ty + 5, name, 'map-label-place', 15) && !place_(tx, ty - 22, name, 'map-label-place', 15)) place_(tx, ty + 34, name, 'map-label-place', 15)
      for (const id of near) {
        const [nx, ny] = p.point(label(id))
        const text = place.kind === 'country' ? (index.meta.countries[id]?.al[0] ?? set.byId.get(id)?.name ?? '') : (set.byId.get(id)?.name ?? '')
        if (text) place_(nx, ny + 4, text, 'map-label-near', 10)
      }
    }
    return { p, paths, tiny, labels, capital }
  }, [set, place, mode, index])

  if (error) return <p className="muted small">{error}</p>
  if (!drawn) return <div className="place-map loading" style={{ aspectRatio: `${ASPECT}` }} aria-label="Loading the map" />
  const { p, paths, tiny, labels, capital } = drawn
  return (
    <svg className={`place-map ${mode}`} viewBox={`0 0 ${W} ${p.height.toFixed(1)}`} role="img" aria-label={mode === 'hint' ? 'A map of the region, with the place filled in' : `A map of ${place.name}${place.capital ? `, with ${place.capital.name} marked` : ''}`}>
      <rect className="map-sea" width={W} height={p.height} />
      {paths
        .filter((x) => x.kind === 'land')
        .map((x) => (
          <path key={x.key} d={x.d} className="map-land" vectorEffect="non-scaling-stroke" />
        ))}
      {paths
        .filter((x) => x.kind === 'neighbor')
        .map((x) => (
          <path key={x.key} d={x.d} className="map-neighbor" vectorEffect="non-scaling-stroke" />
        ))}
      {paths
        .filter((x) => x.kind === 'target')
        .map((x) => (
          <path key={x.key} d={x.d} className="map-target" vectorEffect="non-scaling-stroke" />
        ))}
      {tiny && <circle cx={tiny[0]} cy={tiny[1]} r={9} className="map-ring" />}
      {capital && (
        <g className="map-capital">
          <circle cx={capital[0]} cy={capital[1]} r={4.2} />
          <circle cx={capital[0]} cy={capital[1]} r={1.6} className="map-capital-dot" />
        </g>
      )}
      {labels.map((l, i) => (
        <text key={i} x={l.x} y={l.y} className={l.cls} fontSize={l.size} textAnchor="middle">
          {l.text}
        </text>
      ))}
    </svg>
  )
}

/** "Borders: Spain, Andorra, Belgium…" for the answer side. */
export function Neighbors({ place, index }: { place: Place; index: GeoIndex }) {
  const { set } = useShapes(place.kind)
  if (!set) return null
  const names = (set.neighbors.get(place.id) ?? [])
    .map((id) => (place.kind === 'country' ? index.meta.countries[id]?.n : set.byId.get(id)?.name))
    .filter((x): x is string => !!x)
    .sort((a, b) => a.localeCompare(b))
  if (!names.length) return place.kind === 'country' ? <p className="muted small map-borders">No land borders</p> : null
  return <p className="muted small map-borders">Borders: {names.join(', ')}</p>
}
