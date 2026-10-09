import { useEffect, useState } from 'react'
import { followSystem, loadTheme, onThemeChange, saveTheme, type ThemeChoice } from '../../utils/theme'

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' }
const LABEL: Record<ThemeChoice, string> = { system: 'Match device', light: 'Light', dark: 'Dark' }
const ICON: Record<ThemeChoice, string> = { system: '◐', light: '☀', dark: '☾' }

/** Cycles Match device → Light → Dark. Remembered on this device. */
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(loadTheme)
  useEffect(() => followSystem(choice), [choice])
  useEffect(() => onThemeChange(setChoice), [])
  const next = NEXT[choice]
  return (
    <button
      type="button"
      className="link theme-toggle"
      title={`Theme: ${LABEL[choice]}. Tap for ${LABEL[next]}.`}
      aria-label={`Theme: ${LABEL[choice]}. Switch to ${LABEL[next]}`}
      onClick={() => {
        saveTheme(next)
        setChoice(next)
      }}
    >
      {ICON[choice]}
    </button>
  )
}
