import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { getIntegrations, setDefaultVisibility, setIntegration, setNewTaskDue, setParents, setPhone } from '../../firebase/db'
import { changePassword, signOut } from '../../firebase/auth'
import { auth } from '../../firebase/config'
import { people } from '../../utils/tasks'
import { githubToken, setGithubToken, testToken } from '../../blog/github'
import { useApp } from '../../hooks/useApp'
import type { HouseholdMember } from '../../types'
import { AUDIENCE_ICON, AUDIENCES } from '../../utils/audience'
import { loadTheme, onThemeChange, saveTheme, type ThemeChoice } from '../../utils/theme'
import { ACCENTS, customAccent, loadAccent, loadAccentAll, saveAccent, saveAccentAll, type Accent } from '../../utils/accent'
import { ICON_STYLES, saveIconStyle, useIconStyle } from '../../utils/iconStyle'
import { CHART_STYLES, saveChartStyle, useChartStyle } from '../../utils/chartStyle'
import { DAILY_ITEMS, setDailyGrade, setDailyItemShown, useDailySettings } from '../../daily/settings'
import '@fontsource-variable/datatype/wght.css'
import { Icon, type IconName } from '../UI/Icon'
import { HelpTip } from '../UI/HelpTip'

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
  const [accent, setAccent] = useState<Accent>(loadAccent)
  const [accentAll, setAccentAll] = useState(loadAccentAll)
  const pickAccent = (a: Accent) => {
    saveAccent(a)
    setAccent(a)
  }
  const iconStyle = useIconStyle()
  const chartStyle = useChartStyle()
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
          <h2>Settings</h2>
          <HelpTip topic="settings" />
          <span className="grow" />
          <button type="button" className="link" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="row settings-account">
          <span className="grow small">
            Signed in as <strong>{member.displayName}</strong>
            {auth.currentUser?.email && <span className="muted"> ({auth.currentUser.email})</span>}
          </span>
          <button type="button" className="secondary small" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
        {isMember && (
          <fieldset className="setting">
            <legend>
              Who can see new things <HelpTip topic="privacy" />
            </legend>
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
            <legend>New tasks without a date</legend>
            <p className="muted small">For tasks added in a list or in chat when you don’t give a date.</p>
            <label className="inline">
              <input type="radio" name="newTaskDue" checked={member.newTaskDue !== 'none'} onChange={() => setNewTaskDue(uid, 'today').catch((e) => setError(String(e)))} />
              <Icon name="todo" /> Due the day you add them, so they show on Today (push or change the date later)
            </label>
            <label className="inline">
              <input type="radio" name="newTaskDue" checked={member.newTaskDue === 'none'} onChange={() => setNewTaskDue(uid, 'none').catch((e) => setError(String(e)))} />
              <Icon name="list" /> No date (they stay in their list)
            </label>
          </fieldset>
        )}
        {isMember && (
          <fieldset className="setting">
            <legend>
              Your mobile number <HelpTip topic="texting" />
            </legend>
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
        <PasswordSetting />
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
        <DailySetting />
        {isMember && <AdoptSetting />}
        <fieldset className="setting">
          <legend>Goal mini charts (this device)</legend>
          {CHART_STYLES.map((st) => (
            <label key={st.value} className="inline icon-choice" title={st.hint}>
              <input type="radio" name="charts" checked={chartStyle === st.value} onChange={() => saveChartStyle(st.value)} />
              <span className="icon-choice-name">{st.label}</span>
              <span className="chart-preview" aria-hidden="true">
                {st.value === 'lines' ? (
                  <svg className="sparkline" width={72} height={22}>
                    <line className="spark-ref" x1={3} x2={69} y1={17} y2={17} />
                    <path className="spark-line" d="M3,5 L14,8 L25,7 L36,11 L47,12 L58,14 L69,15" />
                    <circle className="spark-dot" cx={69} cy={15} r={2.5} />
                  </svg>
                ) : (
                  <span className="datatype-chart">{'{l:100,80,85,55,45,30,20}'}</span>
                )}
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
        <fieldset className="setting">
          <legend>Accent color (this device)</legend>
          <p className="muted small">Buttons, your chat messages and what's selected. List colors (blue Just me, purple Family, teal Shared) stay the same.</p>
          <div className="accent-swatches" role="radiogroup" aria-label="Accent color">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={accent.id === a.id}
                className={`accent-swatch${accent.id === a.id ? ' on' : ''}`}
                style={{ '--swatch-light': a.light, '--swatch-dark': a.dark } as CSSProperties}
                title={a.label}
                aria-label={a.label}
                onClick={() => pickAccent(a)}
              />
            ))}
            <label className={`accent-swatch accent-custom${accent.id === 'custom' ? ' on' : ''}`} title="Pick your own color">
              <input type="color" value={accent.light} onChange={(e) => pickAccent(customAccent(e.target.value))} aria-label="Custom accent color" />
            </label>
          </div>
          <label className="inline">
            <input
              type="checkbox"
              checked={accentAll}
              onChange={(e) => {
                saveAccentAll(e.target.checked)
                setAccentAll(e.target.checked)
              }}
            />{' '}
            Highlights too: section icons, selected chips and rows (blue otherwise)
          </label>
        </fieldset>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}

/** Change your password: the current one (checked first), then the new one twice. */
function PasswordSetting() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (next.length < 8) return setMessage({ ok: false, text: 'Use at least 8 characters.' })
    if (next !== again) return setMessage({ ok: false, text: 'The new passwords don’t match.' })
    if (next === current) return setMessage({ ok: false, text: 'That’s the same as your current password.' })
    setBusy(true)
    try {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      setAgain('')
      setOpen(false)
      setMessage({ ok: true, text: 'Password changed. Use the new one next time you sign in.' })
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) })
    }
    setBusy(false)
  }

  return (
    <fieldset className="setting">
      <legend>Password</legend>
      {!open ? (
        <button type="button" className="secondary small" onClick={() => setOpen(true)}>
          Change password
        </button>
      ) : (
        <form className="form password-form" onSubmit={save}>
          <label>
            Current password
            <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </label>
          <label>
            New password
            <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} required />
          </label>
          <label>
            New password again
            <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} minLength={8} required />
          </label>
          <div className="row">
            <button type="submit" className="small" disabled={busy}>
              {busy ? 'Saving…' : 'Change password'}
            </button>
            <button type="button" className="secondary small" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {message && <p className={message.ok ? 'small' : 'error small'} role="status">{message.text}</p>}
      <p className="muted small">Forgot it? Sign out and use “Forgot password?” on the sign-in screen.</p>
    </fieldset>
  )
}

/** The Daily (this device): which items show, and the math puzzle's grade. */
function DailySetting() {
  const { hidden, grade } = useDailySettings()
  return (
    <fieldset className="setting">
      <legend>
        The Daily (this device) <HelpTip topic="daily" />
      </legend>
      <div className="chips">
        {DAILY_ITEMS.map((i) => (
          <label key={i.value} className={`chip-toggle${hidden.has(i.value) ? '' : ' on'}`}>
            <input type="checkbox" checked={!hidden.has(i.value)} onChange={(e) => setDailyItemShown(i.value, e.target.checked)} />
            {i.label}
          </label>
        ))}
      </div>
      <label className="inline">
        Math puzzle grade
        <select value={grade} onChange={(e) => setDailyGrade(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((g) => (
            <option key={g} value={g}>
              Grade {g}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  )
}

/** The household's RescueGroups.org key for The Daily's adoptable pet (shared; only household accounts can read it). */
function AdoptSetting() {
  const [has, setHas] = useState<boolean | null>(null)
  const [key, setKey] = useState('')
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => {
    getIntegrations()
      .then((i) => setHas(!!i.rescueGroupsKey))
      .catch(() => setHas(false))
  }, [])
  async function save(value: string) {
    setNote(null)
    try {
      await setIntegration('rescueGroupsKey', value)
      setHas(!!value.trim())
      setKey('')
      setNote(value.trim() ? 'Saved for the household. Tomorrow’s Daily (or after a reload today) shows a pet near Winter Park.' : 'Removed.')
      for (const k of Object.keys(localStorage)) if (k.endsWith(':adopt')) localStorage.removeItem(k)
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err))
    }
  }
  return (
    <fieldset className="setting">
      <legend>Adoptable pets (household)</legend>
      <p className="muted small">
        The Daily can show a pet up for adoption near Winter Park and Orlando, using RescueGroups.org’s free API. Request a free key at{' '}
        <a href="https://www.rescuegroups.org/?page_id=1004" target="_blank" rel="noopener noreferrer">
          rescuegroups.org
        </a>{' '}
        and paste it here. It’s kept in Align’s data for the household only (never in the app’s code).
      </p>
      {has ? (
        <div className="row">
          <span className="grow">✓ A key is saved.</span>
          <button type="button" className="secondary small" onClick={() => void save('')}>
            Remove
          </button>
        </div>
      ) : (
        <div className="row">
          <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="RescueGroups API key" aria-label="RescueGroups API key" />
          <button type="button" className="small" onClick={() => void save(key)} disabled={!key.trim()}>
            Save
          </button>
        </div>
      )}
      {note && <p className="muted small">{note}</p>}
    </fieldset>
  )
}
