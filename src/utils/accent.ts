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
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', a.light)
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
