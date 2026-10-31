// Map shapes for flashcards (DESIGN.md §5.9): reads a TopoJSON file (world-atlas countries, us-atlas states) into
// rings of [lon, lat] points, finds neighbors (places that share a border arc), and draws SVG paths on a simple
// local projection. Small and dependency-free; unit-tested.

export type Point = [number, number]

interface Topology {
  transform?: { scale: [number, number]; translate: [number, number] }
  arcs: Point[][]
  objects: Record<string, { geometries: { type: string; id?: string; arcs?: unknown; properties?: { name?: string } }[] }>
}

export interface Shape {
  /** The TopoJSON id (ISO numeric for countries, FIPS for states), or the name when there's none. */
  id: string
  name: string
  /** Each polygon is its rings (the first is the outline, the rest holes), each ring [lon, lat] points. */
  polygons: Point[][][]
  arcs: Set<number>
}

/** Every shape in one of the topology's objects. */
export function decodeTopology(topo: Topology, object: string): Shape[] {
  const t = topo.transform
  const arcs = topo.arcs.map((arc) => {
    let x = 0
    let y = 0
    return arc.map(([dx, dy]): Point => {
      if (!t) return [dx, dy]
      x += dx
      y += dy
      return [x * t.scale[0] + t.translate[0], y * t.scale[1] + t.translate[1]]
    })
  })
  const ring = (indexes: number[], used: Set<number>): Point[] => {
    const out: Point[] = []
    for (const i of indexes) {
      const arc = i >= 0 ? arcs[i] : arcs[~i].slice().reverse()
      used.add(i >= 0 ? i : ~i)
      out.push(...(out.length ? arc.slice(1) : arc))
    }
    return out
  }
  return topo.objects[object].geometries.flatMap((g) => {
    const used = new Set<number>()
    const polys =
      g.type === 'Polygon' ? [(g.arcs as number[][]).map((r) => ring(r, used))] : g.type === 'MultiPolygon' ? (g.arcs as number[][][]).map((p) => p.map((r) => ring(r, used))) : []
    if (!polys.length) return []
    return [{ id: String(g.id ?? g.properties?.name ?? ''), name: g.properties?.name ?? '', polygons: polys, arcs: used }]
  })
}

/** Shapes that share a border with each shape (a shared arc), by id. */
export function neighborsOf(shapes: Shape[]): Map<string, string[]> {
  const byArc = new Map<number, string[]>()
  for (const s of shapes) for (const a of s.arcs) byArc.set(a, [...(byArc.get(a) ?? []), s.id])
  const out = new Map<string, Set<string>>()
  for (const ids of byArc.values())
    if (ids.length > 1) for (const a of ids) for (const b of ids) if (a !== b) out.set(a, (out.get(a) ?? new Set()).add(b))
  return new Map([...out].map(([k, v]) => [k, [...v]]))
}

export type Box = [west: number, south: number, east: number, north: number]

export function ringBox(ring: Point[]): Box {
  let w = Infinity
  let s = Infinity
  let e = -Infinity
  let n = -Infinity
  for (const [x, y] of ring) {
    w = Math.min(w, x)
    e = Math.max(e, x)
    s = Math.min(s, y)
    n = Math.max(n, y)
  }
  return [w, s, e, n]
}

const area = (b: Box) => (b[2] - b[0]) * (b[3] - b[1])

/** The part of a shape people picture: its biggest polygon plus the ones close to it (France without French
 *  Guiana, the US without Guam). */
export function mainBox(shape: Shape): Box {
  const boxes = shape.polygons.map((p) => ringBox(p[0]))
  const big = boxes.reduce((a, b) => (area(b) > area(a) ? b : a))
  const pad = Math.max(5, (big[2] - big[0]) * 0.5, (big[3] - big[1]) * 0.5)
  const near = boxes.filter((b) => b[2] >= big[0] - pad && b[0] <= big[2] + pad && b[3] >= big[1] - pad && b[1] <= big[3] + pad)
  return [Math.min(...near.map((b) => b[0])), Math.min(...near.map((b) => b[1])), Math.max(...near.map((b) => b[2])), Math.max(...near.map((b) => b[3]))]
}

/** A point inside the biggest polygon's box, for a label (the middle of its box). */
export function labelPoint(shape: Shape): Point {
  const b = shape.polygons.map((p) => ringBox(p[0])).reduce((a, c) => (area(c) > area(a) ? c : a))
  return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]
}

/** A box grown on every side, then widened or heightened to `aspect` (width / height, after projecting). */
export function frame(box: Box, grow: number, minSpan: number, aspect: number): Box {
  let [w, s, e, n] = box
  const padX = Math.max((e - w) * grow, (minSpan - (e - w)) / 2, 0)
  const padY = Math.max((n - s) * grow, (minSpan - (n - s)) / 2, 0)
  w -= padX
  e += padX
  s = Math.max(-85, s - padY)
  n = Math.min(85, n + padY)
  const k = Math.cos((((s + n) / 2) * Math.PI) / 180)
  const width = (e - w) * k
  const height = n - s
  if (width / height < aspect) {
    const extra = (height * aspect) / k - (e - w)
    w -= extra / 2
    e += extra / 2
  } else {
    const extra = width / aspect - height
    s -= extra / 2
    n += extra / 2
  }
  return [w, s, e, n]
}

/** Draws [lon, lat] into an SVG box `width` wide: a local equirectangular projection (true to shape near the middle
 *  of the frame, which is all a flashcard map shows). Rings far round the globe are shifted to the frame's side. */
export function projector(box: Box, width: number) {
  const [w, s, e, n] = box
  const mid = (w + e) / 2
  const k = Math.cos((((s + n) / 2) * Math.PI) / 180)
  const scale = width / ((e - w) * k)
  const height = (n - s) * scale
  const shift = (lon: number) => (lon - mid > 180 ? lon - 360 : lon - mid < -180 ? lon + 360 : lon)
  const point = ([lon, lat]: Point): Point => [(shift(lon) - w) * k * scale, (n - lat) * scale]
  const ringInView = (ring: Point[]) => {
    const b = ringBox(ring.map(([lon, lat]): Point => [shift(lon), lat]))
    return b[2] >= w && b[0] <= e && b[3] >= s && b[1] <= n
  }
  /** An SVG path for a shape's polygons that reach the frame ('' if none do). */
  const path = (shape: Shape) =>
    shape.polygons
      .filter((p) => ringInView(p[0]))
      .map((p) =>
        p
          .map((r) => {
            // Keep one ring on one side of the globe: shift it whole, by where most of it is.
            const off = shift(r[0][0]) - r[0][0]
            return 'M' + r.map(([lon, lat]) => `${((lon + off - w) * k * scale).toFixed(1)},${((n - lat) * scale).toFixed(1)}`).join('L') + 'Z'
          })
          .join(''),
      )
      .join('')
  return { width, height, point, path }
}
