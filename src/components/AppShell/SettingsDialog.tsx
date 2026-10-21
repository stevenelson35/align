import { useEffect, useState } from 'react'
import { setDefaultVisibility, setParents, setPhone } from '../../firebase/db'
import { people } from '../../utils/tasks'
import { githubToken, setGithubToken, testToken } from '../../blog/github'
import { useApp } from '../../hooks/useApp'
import type { HouseholdMember } from '../../types'
import { AUDIENCE_ICON, AUDIENCES } from '../../utils/audience'
import { loadTheme, onThemeChange, saveTheme, type ThemeChoice } from '../../utils/theme'
import { ICON_STYLES, saveIconStyle, useIconStyle } from '../../utils/iconStyle'
import { Icon, type IconName } from '../UI/Icon'

type DefaultAudience = NonNullable<HouseholdMember['defaultVisibility']>

const PREVIEW: IconName[] = ['compose', 'goal', 'message', 'lock', 'family', 'book', 'calendar', 'search', 'settings', 'skip']

/** Your own settings. Default privacy is saved with your household entry (every device); the theme is per device. */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { uid, member, isMember, household } = useApp()
  const [phone, setPhoneDraft] = useState(member.phone ?? '')
  const [token, setToken] = useState('')
  const [hasToken, setHasToken] = useState(!!githubToken())
  const [tokenNote, setTokenNote] = useState<string | null>(null)

  async function saveToken() {
    setGithubToken(token)
    setToken('')
    setHasToken(true)
    setTokenNote('Saved on this device. Checking it…')
    try {
      await testToken()
      setTokenNote('Saved on this device, and GitHub accepts it.')
    } catch (err) {
      setTokenNote(err instanceof Error ? err.message : String(err))
    }
  }
  const [phoneNote, setPhoneNote] = useState<string | null>(null)
  const parents = new Set(household.groups?.parents ?? [])
  // Matches the rules: anyone may set the group up while it's empty; after that only a parent may change it.
  const canSetParents = parents.size === 0 || parents.has(uid)
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
  const [visibility, setVisibility] = useState<DefaultAudience>(member.defaultVisibility ?? 'everyone')
  const [theme, setTheme] = useState<ThemeChoice>(loadTheme)
  const iconStyle = useIconStyle()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => onThemeChange(setTheme), [])

  async function chooseVisibility(v: DefaultAudience) {
    setVisibility(v)
    setError(null)
    setSaved(false)
    try {
      await setDefaultVisibility(uid, v)
      setSaved(true)
    } catch (err) {
      setVisibility(member.defaultVisibility ?? 'everyone')
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
            <legend>Who can see new things</legend>
            <p className="muted small">For lists you create and quick adds that don't name a list. You can still choose for each list.</p>
            {AUDIENCES.filter((a) => a.value !== 'shared').map((a) => (
              <label key={a.value} className="inline" title={a.hint}>
                <input type="radio" name="visibility" checked={visibility === a.value} onChange={() => chooseVisibility(a.value as DefaultAudience)} />
                <Icon name={AUDIENCE_ICON[a.value]} /> {a.label}
              </label>
            ))}
            <p className="muted small">
              Quick adds go to {visibility === 'private' ? 'your "Inbox"' : visibility === 'parents' ? 'the "Parents Inbox"' : 'the "Family Inbox"'}.
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
              Who "Parents" means when you choose who can see or log something. The people are always shown by name.
            </p>
            <div className="chips">
              {adults.map(([id, m]) => (
                <label key={id} className={`chip-toggle${parents.has(id) ? ' on' : ''}${canSetParents ? '' : ' readonly'}`}>
                  <input type="checkbox" checked={parents.has(id)} disabled={!canSetParents} onChange={() => toggleParent(id)} />
                  {id === uid ? 'You' : m.displayName}
                </label>
              ))}
            </div>
            <p className="muted small">
              {canSetParents
                ? parents.size === 0
                  ? 'Tick yourself (and the other parent). Once set, only parents can change this.'
                  : 'Only parents can change this.'
                : 'Only a parent can change who the parents are.'}
            </p>
          </fieldset>
        )}
        {isMember && (
          <fieldset className="setting">
            <legend>Blog posting (this device)</legend>
            <p className="muted small">
              ✍ New blog post needs a GitHub fine-grained token for the blog repository (Contents: read and write). It's kept only on this device, never
              in Align's data or code.
            </p>
            {hasToken ? (
              <div className="row">
                <span className="grow">✓ A token is saved on this device.</span>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => {
                    setGithubToken('')
                    setHasToken(false)
                    setTokenNote('Removed from this device.')
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="row">
                <input type="password" autoComplete="off" placeholder="github_pat_…" value={token} onChange={(e) => setToken(e.target.value)} aria-label="GitHub token" />
                <button type="button" className="small" onClick={saveToken} disabled={!token.trim()}>
                  Save
                </button>
              </div>
            )}
            {tokenNote && <p className="muted small">{tokenNote}</p>}
          </fieldset>
        )}
        <fieldset className="setting">
          <legend>Icons (this device)</legend>
          {ICON_STYLES.map((st) => (
            <label key={st.value} className="inline icon-choice" title={st.hint}>
              <input type="radio" name="icons" checked={iconStyle === st.value} onChange={() => saveIconStyle(st.value)} />
              <span className="icon-choice-name">{st.label}</span>
              <span className="icon-preview" aria-hidden="true">
                {PREVIEW.map((n) => (
                  <Icon key={n} name={n} style={st.value} />
                ))}
              </span>
            </label>
          ))}
        </fieldset>
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
              <Icon name={t === 'system' ? 'auto' : t === 'light' ? 'sun' : 'moon'} /> {t === 'system' ? 'Match device' : t === 'light' ? 'Light' : 'Dark'}
            </label>
          ))}
        </fieldset>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
