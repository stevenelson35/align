import { useEffect, useState } from 'react'
import countriesUrl from 'world-atlas/countries-50m.json?url'
import statesUrl from 'us-atlas/states-10m.json?url'
import { buildIndex, type GeoIndex, type GeoMeta, type PlaceKind } from '../utils/geo'
import { decodeTopology, neighborsOf, type Shape } from '../utils/topo'

// Flashcard maps load only when a flashcard set is open (names) or a map is first shown (shapes), then stay for the
// session. The shapes are separate files the browser caches.

let index: Promise<GeoIndex> | null = null
export const loadGeoIndex = () => (index ??= import('../data/geo-meta.json').then((m) => buildIndex(m.default as unknown as GeoMeta)))

export interface ShapeSet {
  shapes: Shape[]
  byId: Map<string, Shape>
  neighbors: Map<string, string[]>
}

const shapes: Partial<Record<PlaceKind, Promise<ShapeSet>>> = {}
export function loadShapes(kind: PlaceKind): Promise<ShapeSet> {
  shapes[kind] ??= fetch(kind === 'country' ? countriesUrl : statesUrl)
    .then((r) => {
      if (!r.ok) throw new Error(`The map didn't load (${r.status}).`)
      return r.json()
    })
    .then((topo) => {
      const list = decodeTopology(topo, kind === 'country' ? 'countries' : 'states')
      return { shapes: list, byId: new Map(list.map((s) => [s.id, s])), neighbors: neighborsOf(list) }
    })
    .catch((err) => {
      delete shapes[kind] // try again next time
      throw err
    })
  return shapes[kind]!
}

/** The place names, once loaded (null until then, or when not wanted). */
export function useGeoIndex(enabled = true): GeoIndex | null {
  const [geo, setGeo] = useState<GeoIndex | null>(null)
  useEffect(() => {
    if (!enabled) return
    let live = true
    loadGeoIndex()
      .then((g) => live && setGeo(g))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [enabled])
  return geo
}

export function useShapes(kind: PlaceKind | null): { set: ShapeSet | null; error: string | null } {
  const [got, setGot] = useState<{ kind: PlaceKind; set: ShapeSet } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!kind) return
    let live = true
    loadShapes(kind)
      .then((set) => live && setGot({ kind, set }))
      .catch((err) => live && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      live = false
    }
  }, [kind])
  return { set: got && got.kind === kind ? got.set : null, error }
}
