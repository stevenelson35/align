import { useEffect, useState } from 'react'
import { setDefaultVisibility, setParents, setPhone } from '../../firebase/db'
import { people } from '../../utils/tasks'
import { useApp } from '../../hooks/useApp'
import type { Visibility } from '../../types'
import { loadTheme, onThemeChange, saveTheme, type ThemeChoice } from '../../utils/theme'

/** Your own settings. Default privacy is saved with your household entry (every device); the theme is per device. */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { uid, member, isMember, household } = useApp()
  const [phone, setPhoneDraft] = useState(member.phone ?? '')
  const [phoneNote, setPhoneNote] = useState<string | null>(null)
  const parents = new Set(household.groups?.parents ?? [])
  const adults = people(household, true)

  async function savePhone() {
    setError(null)
    setPhoneNote(null)
    try {
      await setPhone(uid, phone)
      setPhoneNote(phone.trim() ? 'Saved.' : 'Removed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function toggleParent(id: string) {
    const next = new Set(parents)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setError(null)
    try {
      await setParents([...next])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }
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
        {isMember && (
          <fieldset className="setting">
            <legend>Your mobile number</legend>
            <p className="muted small">So others can use "text {member.displayName} …" in chat. Only household members see it.</p>
            <div className="row">
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+1 555 123 4567"
                value={phone}
                maxLength={24}
                onChange={(e) => setPhoneDraft(e.target.value)}
                aria-label="Your mobile number"
              />
              <button type="button" className="small" onClick={savePhone} disabled={(member.phone ?? '') === phone.trim()}>
                Save
              </button>
            </div>
            {phoneNote && <p className="muted small">{phoneNote}</p>}
          </fieldset>
        )}
        {isMember && (
          <fieldset className="setting">
            <legend>Parents</legend>
            <p className="muted small">
              Who the "Parents" shortcut picks when you share a list with chosen people. The people on each shared list are always shown by name.
            </p>
            <div className="chips">
              {adults.map(([id, m]) => (
                <label key={id} className={`chip-toggle${parents.has(id) ? ' on' : ''}`}>
                  <input type="checkbox" checked={parents.has(id)} onChange={() => toggleParent(id)} />
                  {id === uid ? 'You' : m.displayName}
                </label>
              ))}
            </div>
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
