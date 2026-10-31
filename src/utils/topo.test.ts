import { describe, expect, it } from 'vitest'
import { decodeTopology, frame, mainBox, neighborsOf, projector } from './topo'

// Two squares side by side sharing the middle edge (arc 1), quantized with a transform.
const topo = {
  transform: { scale: [1, 1] as [number, number], translate: [0, 0] as [number, number] },
  arcs: [
    [[1, 0], [-1, 0], [0, 1], [1, 0]], // A's outer edge: (1,0) → (0,0) → (0,1) → (1,1)
    [[1, 1], [0, -1]], // shared: (1,1) → (1,0)
    [[1, 1], [1, 0], [0, -1], [-1, 0]], // B's outer edge: (1,1) → (2,1) → (2,0) → (1,0)
  ] as [number, number][][],
  objects: {
    places: {
      geometries: [
        { type: 'Polygon', id: 'A', arcs: [[0, 1]], properties: { name: 'Aland' } },
        { type: 'Polygon', id: 'B', arcs: [[2, -2]], properties: { name: 'Beeland' } },
      ],
    },
  },
}

describe('topojson', () => {
  it('decodes delta-encoded arcs into rings', () => {
    const [a, b] = decodeTopology(topo, 'places')
    expect(a.polygons[0][0]).toEqual([[1, 0], [0, 0], [0, 1], [1, 1], [1, 0]])
    // B goes round the other way, so it takes the shared edge backwards (~1): (1,0) → (1,1).
    expect(b.polygons[0][0]).toEqual([[1, 1], [2, 1], [2, 0], [1, 0], [1, 1]])
    expect(b.name).toBe('Beeland')
  })

  it('finds neighbors by shared borders', () => {
    const n = neighborsOf(decodeTopology(topo, 'places'))
    expect(n.get('A')).toEqual(['B'])
    expect(n.get('B')).toEqual(['A'])
  })

  it('frames and projects', () => {
    const [a] = decodeTopology(topo, 'places')
    expect(mainBox(a)).toEqual([0, 0, 1, 1])
    const f = frame([0, 0, 1, 1], 0.5, 0, 1)
    expect(f[0]).toBeLessThan(0)
    const p = projector([0, 0, 2, 1], 200)
    expect(p.point([0, 1])).toEqual([0, 0])
    expect(p.path(a).startsWith('M')).toBe(true)
  })
})
