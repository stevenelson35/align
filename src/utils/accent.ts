// The accent color (buttons, your chat bubbles, selection rings): purple unless changed in Settings. Remembered per
// device like the theme; index.html applies it before the first paint (no flash), so keep the two in step.
// Separate from the list colors (§8): purple still means a family list whatever the accent is.

export interface Accent {
  id: string
  label: string
  /** For light and dark mode; white button text must stay readable on both. */
  light: string
  dark: string
}

export const ACCENTS: Accent[] = [
  { id: 'purple', label: 'Purple', light: '#8250df', dark: '#a371f7' },
  { id: 'blue', label: 'Blue', light: '#0969da', dark: '#2f81f7' },
  { id: 'teal', label: 'Teal', light: '#0f7b7d', dark: '#1b9a9c' },
  { id: 'green', label: 'Green', light: '#1a7f37', dark: '#2ea043' },
  { id: 'orange', label: 'Orange', light: '#bc4c00', dark: '#db6d28' },
  { id: 'red', label: 'Red', light: '#cf222e', dark: '#da3633' },
  { id: 'pink', label: 'Pink', light: '#bf3989', dark: '#db61a2' },
  { id: 'gray', label: 'Gray', light: '#57606a', dark: '#6e7681' },
]

const KEY = 'align-accent'
export const DEFAULT_ACCENT = ACCENTS[0]

/** The saved accent: a preset, or { id: 'custom' } with one color for both modes. */
export function loadAccent(): Accent {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Accent> | null
    if (saved && typeof saved.light === 'string' && /^#[0-9a-f]{6}$/i.test(saved.light) && typeof saved.dark === 'string' && /^#[0-9a-f]{6}$/i.test(saved.dark))
      return ACCENTS.find((a) => a.id === saved.id) ?? { id: 'custom', label: 'Custom', light: saved.light, dark: saved.dark }
  } catch {
    // a bad saved value falls back to the default
  }
  return DEFAULT_ACCENT
}

export function applyAccent(a: Accent) {
  const root = document.documentElement.style
  root.setProperty('--brand-light', a.light)
  root.setProperty('--brand-dark', a.dark)
  applyBars()
}

export function saveAccent(a: Accent) {
  if (a.id === DEFAULT_ACCENT.id) localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, JSON.stringify({ id: a.id, light: a.light, dark: a.dark }))
  applyAccent(a)
}

/** A custom color, used as is in both modes. */
export const customAccent = (hex: string): Accent => ({ id: 'custom', label: 'Custom', light: hex, dark: hex })

const ALL_KEY = 'align-accent-all'

/** Whether highlights (section icons, selected chips and rows) use the accent too, instead of blue. */
export const loadAccentAll = () => localStorage.getItem(ALL_KEY) === '1'

export function saveAccentAll(on: boolean) {
  if (on) localStorage.setItem(ALL_KEY, '1')
  else localStorage.removeItem(ALL_KEY)
  if (on) document.documentElement.dataset.accentAll = ''
  else delete document.documentElement.dataset.accentAll
}

// Phone bars: the color the phone gives its status bar (and, on Android, the navigation bar) while Align is open
// (<meta name="theme-color">). The accent by default, or plain (the page's own white / dark), or a color of your own.
export type Bars = 'accent' | 'plain' | string

const BARS_KEY = 'align-bars'
const PLAIN = { light: '#ffffff', dark: '#161b22' }

export function loadBars(): Bars {
  const saved = localStorage.getItem(BARS_KEY)
  return saved === 'plain' || (saved && /^#[0-9a-f]{6}$/i.test(saved)) ? saved : 'accent'
}

export function barsColor(bars: Bars, dark: boolean): string {
  if (bars === 'plain') return dark ? PLAIN.dark : PLAIN.light
  if (bars !== 'accent') return bars
  const a = loadAccent()
  return dark ? a.dark : a.light
}

export function applyBars() {
  const dark = document.documentElement.dataset.theme === 'dark'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', barsColor(loadBars(), dark))
}

export function saveBars(bars: Bars) {
  if (bars === 'accent') localStorage.removeItem(BARS_KEY)
  else localStorage.setItem(BARS_KEY, bars)
  applyBars()
}

/** Keeps the phone bars right when light / dark changes (Settings, the top-bar button, or the device). */
export function watchBars() {
  applyBars()
  new MutationObserver(applyBars).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
}

// The list colors of the color key (DESIGN.md §8): blue Just me, purple Family / Everyone, teal Parents · Chosen
// people, green Project, gray Finished. Each can be changed on this device; a changed one is used in light and dark.
export const LIST_COLORS = [
  { id: 'private', label: 'Only me', light: '#1f6feb', dark: '#4493f8' },
  { id: 'family', label: 'Family / Everyone', light: '#8250df', dark: '#a371f7' },
  { id: 'shared', label: 'Parents · Chosen people', light: '#0f8b8d', dark: '#39c5cf' },
  { id: 'project', label: 'Project', light: '#1a7f37', dark: '#3fb950' },
  { id: 'done', label: 'Finished', light: '#8c959f', dark: '#6e7681' },
] as const

export type ListColorId = (typeof LIST_COLORS)[number]['id']
const LIST_KEY = 'align-list-colors'

export function loadListColors(): Partial<Record<ListColorId, string>> {
  try {
    const saved = JSON.parse(localStorage.getItem(LIST_KEY) ?? '{}') as Record<string, unknown>
    return Object.fromEntries(LIST_COLORS.filter((c) => typeof saved[c.id] === 'string' && /^#[0-9a-f]{6}$/i.test(saved[c.id] as string)).map((c) => [c.id, saved[c.id]]))
  } catch {
    return {}
  }
}

export function saveListColors(colors: Partial<Record<ListColorId, string>>) {
  if (Object.keys(colors).length) localStorage.setItem(LIST_KEY, JSON.stringify(colors))
  else localStorage.removeItem(LIST_KEY)
  const root = document.documentElement.style
  for (const c of LIST_COLORS) {
    const v = colors[c.id]
    if (v) root.setProperty(`--color-${c.id}`, v)
    else root.removeProperty(`--color-${c.id}`)
  }
}
