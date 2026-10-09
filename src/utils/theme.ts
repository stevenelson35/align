// Light / dark mode. The choice is remembered per device; "system" follows the device's setting.
// index.html applies it before the first paint (no flash); keep the two in step.
export type ThemeChoice = 'system' | 'light' | 'dark'

const KEY = 'align-theme'
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

export function loadTheme(): ThemeChoice {
  const saved = localStorage.getItem(KEY)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

export function applyTheme(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && darkQuery().matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

export function saveTheme(choice: ThemeChoice) {
  if (choice === 'system') localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, choice)
  applyTheme(choice)
}

/** Re-applies "system" when the device switches between light and dark. Returns an unsubscribe function. */
export function followSystem(choice: ThemeChoice): () => void {
  if (choice !== 'system') return () => {}
  const q = darkQuery()
  const onChange = () => applyTheme('system')
  q.addEventListener('change', onChange)
  return () => q.removeEventListener('change', onChange)
}
