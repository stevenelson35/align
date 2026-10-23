// The goal mini charts' look, chosen per device in Settings: SVG lines (the default) or the Datatype font, which
// draws a chart from text such as "{l:10,40,25}" (OpenType ligatures; github.com/franktisellano/datatype, OFL).
import { useSyncExternalStore } from 'react'

export type ChartStyle = 'lines' | 'datatype'
export const CHART_STYLES: { value: ChartStyle; label: string; hint: string }[] = [
  { value: 'lines', label: 'Lines', hint: 'A thin line with the target dashed and a dot on the latest value' },
  { value: 'datatype', label: 'Datatype font', hint: 'Charts drawn by a font: sparklines, bars and pies, no target line' },
]

const KEY = 'align-goal-charts'
const listeners = new Set<() => void>()

export function loadChartStyle(): ChartStyle {
  return localStorage.getItem(KEY) === 'datatype' ? 'datatype' : 'lines'
}

export function saveChartStyle(style: ChartStyle) {
  if (style === 'lines') localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, style)
  listeners.forEach((l) => l())
}

export function useChartStyle(): ChartStyle {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    loadChartStyle,
    () => 'lines',
  )
}

/** Values scaled to Datatype's 0–100, whole numbers, at most 20 (the latest). `lo`/`hi` default to the values' range. */
export function to100(values: number[], lo = Math.min(...values), hi = Math.max(...values)): number[] {
  const span = hi - lo || 1
  return values.slice(-20).map((v) => Math.max(0, Math.min(100, Math.round(((v - lo) / span) * 100))))
}

/** Datatype text: a sparkline "{l:…}", bars "{b:…}", or a pie "{p:…}". */
export const datatypeLine = (values: number[], lo?: number, hi?: number) => `{l:${to100(values, lo, hi).join(',')}}`
export const datatypeBars = (values: number[], hi = Math.max(...values, 1)) => `{b:${to100(values, 0, hi).join(',')}}`
export const datatypePie = (fraction: number) => `{p:${Math.max(0, Math.min(100, Math.round(fraction * 100)))}}`
