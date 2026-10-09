import { useEffect, useState } from 'react'
import { setDefaultVisibility } from '../../firebase/db'
import { useApp } from '../../hooks/useApp'
import type { Visibility } from '../../types'
import { loadTheme, onThemeChange, saveTheme, type ThemeChoice } from '../../utils/theme'

/** Your own settings. Default privacy is saved with your household entry (every device); the theme is per device. */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { uid, member, isMember } = useApp()
  const [visibility, setVisibility] = useState<Visibility>(member.defaultVisibility ?? 'private')
  const [theme, setTheme] = useState<ThemeChoice>(loadTheme)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => onThemeChange(setTheme), [])

  async function chooseVisibility(v: Visibility) {
    setVisibility(v)
    setError(null)
    setSaved(false)
    try {
      await setDefaultVisibility(uid, v)
      setSaved(true)
    } catch (err) {
      setVisibility(member.defaultVisibility ?? 'private')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card form modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <header className="row">
          <h2 className="grow">Settings</h2>
          <button type="button" className="link" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {isMember && (
          <fieldset className="setting">
            <legend>Default privacy</legend>
            <p className="muted small">For lists you create and quick adds that don't name a list. You can still choose for each list.</p>
            <label className="inline">
              <input type="radio" name="visibility" checked={visibility === 'private'} onChange={() => chooseVisibility('private')} />
              🔒 Just me
            </label>
            <label className="inline">
              <input type="radio" name="visibility" checked={visibility === 'family'} onChange={() => chooseVisibility('family')} />
              👪 Family
            </label>
            <p className="muted small">
              {visibility === 'family' ? 'Quick adds go to the shared "Family Inbox" list.' : 'Quick adds go to your private "Inbox" list.'}
              {saved && ' Saved.'}
            </p>
          </fieldset>
        )}
        <fieldset className="setting">
          <legend>Theme (this device)</legend>
          {(['system', 'light', 'dark'] as ThemeChoice[]).map((t) => (
            <label key={t} className="inline">
              <input
                type="radio"
                name="theme"
                checked={theme === t}
                onChange={() => {
                  saveTheme(t)
                  setTheme(t)
                }}
              />
              {t === 'system' ? '◐ Match device' : t === 'light' ? '☀ Light' : '☾ Dark'}
            </label>
          ))}
        </fieldset>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
