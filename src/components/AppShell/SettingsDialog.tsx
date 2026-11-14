import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { getIntegrations, setDefaultVisibility, setIntegration, setMemberColor, setNewTaskDue, setParents, setPhone, setRevealManager, setTodayPanelStyles } from '../../firebase/db'
import { changePassword, signOut } from '../../firebase/auth'
import { addPerson, currentSlot, loadAccounts, switchTo } from '../../firebase/accounts'
import { auth } from '../../firebase/config'
import { today } from '../../engine/dates'
import { people } from '../../utils/tasks'
import { githubToken, setGithubToken, testToken } from '../../blog/github'
import { useApp } from '../../hooks/useApp'
import type { HouseholdMember, TodayPanelStyle, TodaySurface } from '../../types'
import { AUDIENCE_ICON, AUDIENCES } from '../../utils/audience'
import { loadTheme, onThemeChange, saveTheme, type ThemeChoice } from '../../utils/theme'
import { ACCENTS, barsColor, customAccent, LIST_COLORS, loadAccent, loadAccentAll, loadBars, loadListColors, saveAccent, saveAccentAll, saveBars, saveListColors, type Accent, type Bars, type ListColorId } from '../../utils/accent'
import { ICON_STYLES, saveIconStyle, useIconStyle } from '../../utils/iconStyle'
import { CHART_STYLES, saveChartStyle, useChartStyle } from '../../utils/chartStyle'
import { DAILY_ITEMS, setDailyGrade, setDailyItemShown, useDailySettings } from '../../daily/settings'
import '@fontsource-variable/datatype/wght.css'
import { Icon, type IconName } from '../UI/Icon'
import { HelpTip } from '../UI/HelpTip'
import { loadWeatherSettings, saveWeatherSettings } from '../../hooks/useWeather'
import { DEFAULT_PLACE, FORECAST_SITES, forecastLink, geocodeUrl, parsePlaces, type WeatherPlace, type WeatherSettings } from '../../utils/weather'
import { replaceCurrentReveal, saveRevealPhoto, useReveal, useRevealPhoto } from '../../firebase/rewards'
import { photoCaption, photoUrl } from '../../photos/favorites'
import { useFavorites } from '../../hooks/useFavorites'
import { PhotoPicker } from '../Photos/PhotoPicker'
import { NotifyToggle } from '../Inbox/NotifyToggle'
import { TileGapSetting } from '../Today/TileGapSetting'
import { hasSettingsPin, removeSettingsPin, saveSettingsPin, verifySettingsPin } from '../../utils/settingsPin'

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
  const revealManager = household.groups?.revealManager
  const canConfigureRevealManager = revealManager ? revealManager === uid : parents.has(uid)
  const adults = people(household, true)
  const pinSet = hasSettingsPin(uid)
  const [unlockedPinUid, setUnlockedPinUid] = useState<string | null>(null)
  const pinLocked = pinSet && unlockedPinUid !== uid

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
        <SwitchPerson />
        {pinLocked ? (
          <SettingsPinPrompt uid={uid} onUnlock={() => setUnlockedPinUid(uid)} />
        ) : (
          <>
            <SettingsPinSetting uid={uid} enabled={pinSet} onPinSet={() => setUnlockedPinUid(uid)} onPinRemoved={() => setUnlockedPinUid(null)} />
        {isMember && <YourColorSetting />}
        {isMember && <TodayPanelsSetting uid={uid} member={member} />}
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
              Notifications <HelpTip topic="inbox" />
            </legend>
            <NotifyToggle />
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
            {!revealManager && parents.size === 0 && (
              <p className="muted small">Choose yourself in Parents to set up a sole Reveal picture manager; other accounts won’t see the picture controls.</p>
            )}
          </fieldset>
        )}
        {isMember && canConfigureRevealManager && <RevealManagerSetting managerUid={revealManager} members={adults} />}
        {isMember && revealManager === uid && <RevealPhotoSetting uid={uid} />}
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
          <legend>Today spacing (this device)</legend>
          <TileGapSetting />
          <p className="muted small">The space between tiles and groups on Today. Also in Arrange.</p>
        </fieldset>
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
          <p className="muted small">Buttons, your chat messages and what's selected. The color key's colors (blue Just me, purple Family…) are separate: change them below.</p>
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
        <WeatherSetting />
        <PhoneBarsSetting />
        <ListColorsSetting />
        {error && <p className="error">{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}

/** Change your password: the current one (checked first), then the new one twice. */
/**
 * Someone else on this phone (a child borrowing it): one tap opens Align as them, and everything they do counts as
 * them. Each person signs in once on this device; after that, switching needs no password.
 */
function SwitchPerson() {
  const others = loadAccounts().filter((a) => a.slot !== currentSlot())
  return (
    <div className="switch-person">
      <span className="small muted">{others.length ? 'Switch to:' : 'Someone else using this device?'}</span>
      {others.map((a) => (
        <button key={a.slot} type="button" className="secondary small person-chip" onClick={() => switchTo(a.slot)} title={`Open Align as ${a.name}`}>
          <span className="person-dot" style={{ background: a.color }} aria-hidden="true" /> {a.name}
        </button>
      ))}
      <button type="button" className="link small" onClick={addPerson} title="They sign in once; after that it's one tap to switch">
        + Add someone
      </button>
    </div>
  )
}

function SettingsPinPrompt({ uid, onUnlock }: { uid: string; onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  async function unlock(event: FormEvent) {
    event.preventDefault()
    setChecking(true)
    setError(null)
    try {
      if (await verifySettingsPin(uid, pin)) onUnlock()
      else setError('That PIN did not match.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setChecking(false)
    }
  }

  return (
    <form className="setting" onSubmit={(event) => void unlock(event)}>
      <h3>Settings locked</h3>
      <p className="muted small">Enter this account’s PIN to open its settings. You can still switch users above. If you forget it, clear Align’s site data on this device.</p>
      <div className="row">
        <input
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
          aria-label="Settings PIN"
          required
        />
        <button type="submit" className="small" disabled={checking || pin.length !== 4}>{checking ? 'Checking…' : 'Unlock settings'}</button>
      </div>
      {error && <p className="error small">{error}</p>}
    </form>
  )
}

function SettingsPinSetting({
  uid, enabled, onPinSet, onPinRemoved,
}: {
  uid: string
  enabled: boolean
  onPinSet: () => void
  onPinRemoved: () => void
}) {
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNote(null)
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('Choose a four-digit PIN.')
      return
    }
    if (pin !== confirmPin) {
      setError('The PINs do not match.')
      return
    }
    setSaving(true)
    try {
      await saveSettingsPin(uid, pin)
      setPin('')
      setConfirmPin('')
      setNote('Settings PIN saved on this device.')
      onPinSet()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  function remove() {
    removeSettingsPin(uid)
    setPin('')
    setConfirmPin('')
    setNote('Settings PIN removed from this device.')
    setError(null)
    onPinRemoved()
  }

  return (
    <fieldset className="setting">
      <legend>Settings PIN (this device)</legend>
      <p className="muted small">
        {enabled ? 'A PIN is required to open this account’s settings.' : 'Optionally lock this account’s settings with a four-digit PIN.'}
        {' '}This is a convenience lock, not account security; switching users remains available without a PIN. If forgotten, clear Align’s site data on this device.
      </p>
      <form onSubmit={(event) => void save(event)}>
        <div className="row">
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={4}
            placeholder={enabled ? 'New PIN' : 'Four-digit PIN'}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
            aria-label={enabled ? 'New settings PIN' : 'Settings PIN'}
          />
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={4}
            placeholder="Confirm PIN"
            value={confirmPin}
            onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
            aria-label="Confirm settings PIN"
          />
          <button type="submit" className="small" disabled={saving || pin.length !== 4 || confirmPin.length !== 4}>
            {saving ? 'Saving…' : enabled ? 'Change PIN' : 'Set PIN'}
          </button>
          {enabled && <button type="button" className="link small" onClick={remove} disabled={saving}>Remove PIN</button>}
        </div>
      </form>
      {note && <p className="muted small" role="status">{note}</p>}
      {error && <p className="error small">{error}</p>}
    </fieldset>
  )
}

function RevealManagerSetting({ managerUid, members }: { managerUid?: string; members: [string, HouseholdMember][] }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  async function chooseManager(uid: string) {
    setSaving(true)
    setError(null)
    setNote(null)
    try {
      await setRevealManager(uid || null)
      setNote(uid ? 'Reveal picture manager updated.' : 'Reveal picture manager removed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <fieldset className="setting">
      <legend>Reveal picture manager</legend>
      <p className="muted small">Only this account can see or change the current and next Reveal pictures in Settings.</p>
      <label className="inline small">
        Account
        <select value={managerUid ?? ''} disabled={saving} onChange={(event) => void chooseManager(event.target.value)}>
          <option value="">Choose one account…</option>
          {members.map(([uid, member]) => <option key={uid} value={uid}>{member.displayName}</option>)}
        </select>
      </label>
      {note && <p className="muted small" role="status">{note}</p>}
      {error && <p className="error small">{error}</p>}
    </fieldset>
  )
}

/** White on these stays readable (the initial in your circle). */
const PERSON_COLORS = ['#1f6feb', '#bf3989', '#bc4c00', '#1a7f37', '#57606a', '#8250df', '#0f7b7d', '#cf222e', '#9a6700']

/** Your color, saved with your household entry (every device): your circle at the top right, your map dot. */
function YourColorSetting() {
  const { uid, member } = useApp()
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pick = (color: string) => {
    setError(null)
    setMemberColor(uid, color).catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }
  // Dragging in the color picker changes it many times a second: save once it settles.
  const drag = (color: string) => {
    setShown(color)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => pick(color), 600)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  const current = (shown ?? member.color)?.toLowerCase()
  return (
    <fieldset className="setting">
      <legend>Your color</legend>
      <p className="muted small">The circle with your initial (top right), your dot on the family map and your name tags, for everyone.</p>
      <div className="accent-swatches" role="radiogroup" aria-label="Your color">
        {PERSON_COLORS.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={current === c} className={`accent-swatch${current === c ? ' on' : ''}`} style={{ '--swatch-light': c, '--swatch-dark': c } as CSSProperties} aria-label={c} title={c} onClick={() => {
              setShown(null)
              pick(c)
            }} />
        ))}
        <label className={`accent-swatch accent-custom${current && !PERSON_COLORS.includes(current) ? ' on' : ''}`} title="Pick your own color">
          <input type="color" value={current && /^#[0-9a-f]{6}$/.test(current) ? current : '#1f6feb'} onChange={(e) => drag(e.target.value)} aria-label="Custom color" />
        </label>
      </div>
      {error && <p className="error small">{error}</p>}
    </fieldset>
  )
}

/**
 * Today's weather (this device): where (automatic = your family-map location while you share it, else Orlando; or a
 * place you search for) and which site the place's link opens (a few, or your own address with {lat} {lon} {name}).
 */
function WeatherSetting() {
  const [s, setS] = useState<WeatherSettings>(loadWeatherSettings)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<WeatherPlace[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [custom, setCustom] = useState(s.custom ?? '')
  const [error, setError] = useState<string | null>(null)
  const save = (next: WeatherSettings) => {
    saveWeatherSettings(next)
    setS(next)
  }
  async function search(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setError(null)
    try {
      const res = await fetch(geocodeUrl(query))
      setFound(res.ok ? parsePlaces(await res.json()) : [])
    } catch {
      setError('The place search isn’t available right now.')
    } finally {
      setSearching(false)
    }
  }
  const customOk = !!forecastLink(custom, DEFAULT_PLACE)
  return (
    <fieldset className="setting">
      <legend>Weather (this device)</legend>
      <p className="muted small">The weather beside Today’s date.</p>
      <label className="inline">
        <input type="radio" name="weather-place" checked={s.place === 'auto'} onChange={() => save({ ...s, place: 'auto' })} /> Automatic: where you are while you share your location on the family map, otherwise {DEFAULT_PLACE.name}
      </label>
      <label className="inline">
        <input type="radio" name="weather-place" checked={s.place !== 'auto'} onChange={() => s.place === 'auto' && save({ ...s, place: DEFAULT_PLACE })} /> A place: <strong>{s.place === 'auto' ? '(search below)' : s.place.name}</strong>
      </label>
      <form className="row" onSubmit={search}>
        <input type="search" className="grow" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a city or town…" aria-label="Find a place for the weather" />
        <button type="submit" className="secondary small" disabled={searching || !query.trim()}>
          {searching ? 'Finding…' : 'Find'}
        </button>
      </form>
      {found && (found.length ? (
        <div className="weather-places">
          {found.map((p) => (
            <button
              key={`${p.lat},${p.lon}`}
              type="button"
              className="link small"
              onClick={() => {
                save({ ...s, place: p })
                setFound(null)
                setQuery('')
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="muted small">No place by that name.</p>
      ))}
      <p className="small">The place’s link opens:</p>
      {FORECAST_SITES.map((f) => (
        <label key={f.id} className="inline">
          <input type="radio" name="weather-site" checked={s.site === f.id} onChange={() => save({ ...s, site: f.id })} /> {f.label}
        </label>
      ))}
      <label className="inline">
        <input type="radio" name="weather-site" checked={s.site === 'custom'} onChange={() => customOk && save({ ...s, site: 'custom', custom })} disabled={!customOk} /> My own address:
      </label>
      <div className="row">
        <input
          className="grow"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="https://example.com/forecast?lat={lat}&lon={lon}"
          aria-label="Your own forecast address"
          inputMode="url"
        />
        <button type="button" className="secondary small" disabled={!customOk || (s.site === 'custom' && s.custom === custom.trim())} onClick={() => save({ ...s, site: 'custom', custom: custom.trim() })}>
          Use it
        </button>
      </div>
      <p className="muted small">{'{lat}'}, {'{lon}'} and {'{name}'} are filled in with the place. Weather data and place search by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo.com</a> (CC BY 4.0).</p>
      {error && <p className="error small">{error}</p>}
    </fieldset>
  )
}

/** The phone's status / navigation bars while Align is open: the accent, plain, or your own color (this device). */
function PhoneBarsSetting() {
  const [bars, setBars] = useState<Bars>(loadBars)
  const choose = (b: Bars) => {
    saveBars(b)
    setBars(b)
  }
  const custom = bars !== 'accent' && bars !== 'plain'
  const dark = document.documentElement.dataset.theme === 'dark'
  return (
    <fieldset className="setting">
      <legend>Phone bars (this device)</legend>
      <p className="muted small">The bar across the top of the screen (and the bottom one on Android) while Align is open from your home screen.</p>
      <label className="inline">
        <input type="radio" name="bars" checked={bars === 'accent'} onChange={() => choose('accent')} /> Accent color
      </label>
      <label className="inline">
        <input type="radio" name="bars" checked={bars === 'plain'} onChange={() => choose('plain')} /> Plain (white, or dark in Dark)
      </label>
      <label className="inline">
        <input type="radio" name="bars" checked={custom} onChange={() => choose(barsColor(bars, dark))} /> My own:{' '}
        <input type="color" className="color-input" value={custom ? bars : barsColor(bars, dark)} onChange={(e) => choose(e.target.value)} aria-label="Phone bar color" />
      </label>
      <p className="muted small">A web page opened from Align (a link) has its own bar, in the color Align had when it was added to the home screen.</p>
    </fieldset>
  )
}

const PANEL_OPTIONS: { id: TodaySurface; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'more', label: 'More' },
]
const PANEL_STICKERS = ['', '🌈', '⭐', '🐾', '🐈', '🌻', '🦋', '🎮', '🍓', '🪴', '🚀', '🧩', '🌙', '☀️']

function TodayPanelsSetting({ uid, member }: { uid: string; member: HouseholdMember }) {
  const [styles, setStyles] = useState<Partial<Record<TodaySurface, TodayPanelStyle>>>(member.todayPanels ?? {})
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState<TodaySurface | null>(null)
  const [note, setNote] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setNote(null)
    try {
      await setTodayPanelStyles(uid, styles)
      setNote('Saved for your account.')
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const update = (surface: TodaySurface, patch: TodayPanelStyle) => {
    const next = { ...styles }
    const value = { ...next[surface], ...patch }
    if (!value.color && !value.sticker && !value.image) delete next[surface]
    else next[surface] = value
    setStyles(next)
    setNote(null)
  }

  return (
    <fieldset className="setting">
      <legend>Today panel decorations</legend>
      <p className="muted small">Give Today and More their own color, sticker, or photo background. These follow your account.</p>
      {PANEL_OPTIONS.map(({ id, label }) => (
        <div className="today-panel-setting" key={id}>
          <div className="today-panel-style">
            <strong className="grow small">{label}</strong>
            <label className="inline small">
              Color
              <input
                type="color"
                className="color-input"
                value={styles[id]?.color ?? '#ffffff'}
                onChange={(e) => update(id, { color: e.target.value })}
                disabled={saving}
                aria-label={`${label} panel color`}
              />
            </label>
            <label className="inline small">
              Sticker
              <select value={styles[id]?.sticker ?? ''} onChange={(e) => update(id, { sticker: e.target.value })} aria-label={`${label} panel sticker`} disabled={saving}>
                {PANEL_STICKERS.map((sticker) => <option key={sticker || 'none'} value={sticker}>{sticker || 'None'}</option>)}
              </select>
            </label>
          </div>
          <div className="row">
            {styles[id]?.image && <img className="today-panel-image-preview" src={photoUrl(styles[id]!.image!, 640)} alt={`${label} panel background`} />}
            <button type="button" className="secondary small" onClick={() => setPicking(id)} disabled={saving}>
              {styles[id]?.image ? 'Change background photo…' : 'Choose background photo…'}
            </button>
            {styles[id]?.image && <button type="button" className="link small" onClick={() => update(id, { image: '' })} disabled={saving}>Remove photo</button>}
            {(styles[id]?.color || styles[id]?.sticker || styles[id]?.image) && (
              <button type="button" className="link small" onClick={() => update(id, { color: '', sticker: '', image: '' })} aria-label={`Reset ${label} panel`} disabled={saving}>
                Reset
              </button>
            )}
          </div>
        </div>
      ))}
      <div className="row">
        <button type="button" className="small" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save panels'}</button>
        {note && <span className="muted small" role="status">{note}</span>}
      </div>
      {picking && <PhotoPicker onPick={(photo) => { update(picking, { image: photo.id }); setPicking(null) }} onClose={() => setPicking(null)} />}
    </fieldset>
  )
}

function RevealPhotoSetting({ uid }: { uid: string }) {
  const { photoId, error: loadError } = useRevealPhoto()
  const reveal = useReveal()
  const { manifest } = useFavorites()
  const [pickingNext, setPickingNext] = useState(false)
  const [pickingCurrent, setPickingCurrent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [currentNote, setCurrentNote] = useState<string | null>(null)
  const [nextNote, setNextNote] = useState<string | null>(null)
  const nextPhoto = photoId ? manifest?.photos.find((p) => p.id === photoId) : undefined
  const currentPhoto = reveal && reveal !== null ? manifest?.photos.find((p) => p.id === reveal.photoId) : undefined

  async function save(id: string | null) {
    setSaving(true)
    setSaveError(null)
    setNextNote(null)
    try {
      await saveRevealPhoto(uid, id)
      setPickingNext(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function changeCurrent(photoId: string) {
    setPickingCurrent(false)
    if (!reveal || reveal === null) return
    if (photoId === reveal.photoId) {
      setCurrentNote('This picture is already the active Reveal.')
      return
    }
    const photo = manifest?.photos.find((p) => p.id === photoId)
    const name = photo ? photoCaption(photo) : photoId
    if (!window.confirm(`Replace the active Reveal with ${name}? This resets its uncovered progress and moves spent. The current picture can't be restored.`)) return
    setSaving(true)
    setSaveError(null)
    setCurrentNote(null)
    try {
      await replaceCurrentReveal(uid, photoId, today())
      setCurrentNote('The active Reveal now uses this picture. The separately selected next picture is unchanged.')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <fieldset className="setting">
        <legend>Current Reveal picture</legend>
        {reveal === undefined ? (
          <p className="muted small">Loading…</p>
        ) : reveal ? (
          <div className="row">
            <span className="grow small">{currentPhoto ? photoCaption(currentPhoto) : 'Active family photo'}</span>
            <button type="button" className="secondary small" onClick={() => setPickingCurrent(true)} disabled={saving}>
              Change active picture…
            </button>
          </div>
        ) : (
          <p className="muted small">There is no active Reveal to change.</p>
        )}
        {reveal && <img src={photoUrl(reveal.photoId, 640)} alt={currentPhoto ? photoCaption(currentPhoto) : 'Active family photo'} style={{ maxWidth: 160, borderRadius: 8 }} />}
        <p className="muted small">Changing it resets the active board’s progress. The next-picture choice is separate.</p>
        {currentNote && <p className="muted small" role="status">{currentNote}</p>}
        {pickingCurrent && <PhotoPicker onPick={(p) => void changeCurrent(p.id)} onClose={() => setPickingCurrent(false)} />}
      </fieldset>
      <fieldset className="setting">
        <legend>Next Reveal picture</legend>
        <p className="muted small">Choose a family photo from Favorites for the next reveal. It will be used once; otherwise, Align picks one at random.</p>
        {loadError ? (
          <p className="error small">{loadError}</p>
        ) : photoId === undefined ? (
          <p className="muted small">Loading…</p>
        ) : photoId ? (
        <div className="row">
          <span className="grow small">{nextPhoto ? photoCaption(nextPhoto) : 'A selected family photo'}</span>
          <button type="button" className="secondary small" onClick={() => void save(null)} disabled={saving}>Use random</button>
        </div>
      ) : null}
        {photoId && <img src={photoUrl(photoId, 640)} alt={nextPhoto ? photoCaption(nextPhoto) : 'Selected family photo'} style={{ maxWidth: 160, borderRadius: 8 }} />}
        <button type="button" className="secondary small" onClick={() => setPickingNext(true)} disabled={saving || photoId === undefined || !!loadError}>
          Choose a photo…
        </button>
        {nextNote && <p className="muted small" role="status">{nextNote}</p>}
        {pickingNext && <PhotoPicker onPick={(p) => void save(p.id)} onClose={() => setPickingNext(false)} />}
      </fieldset>
      {saveError && <p className="error small">{saveError}</p>}
    </>
  )
}

/** The color key's colors (Only me, Family, Parents · Chosen people, Project, Finished), this device only. */
function ListColorsSetting() {
  const [colors, setColors] = useState(loadListColors)
  const dark = document.documentElement.dataset.theme === 'dark'
  const set = (next: Partial<Record<ListColorId, string>>) => {
    saveListColors(next)
    setColors(next)
  }
  return (
    <fieldset className="setting">
      <legend>Color key colors (this device)</legend>
      <p className="muted small">The stripe on each task and list, and the colors in the color key.</p>
      {LIST_COLORS.map((c) => (
        <label key={c.id} className="inline list-color-row">
          <input
            type="color"
            className="color-input"
            value={colors[c.id] ?? (dark ? c.dark : c.light)}
            onChange={(e) => set({ ...colors, [c.id]: e.target.value })}
            aria-label={`${c.label} color`}
          />{' '}
          <span className={`key color-${c.id}`}>{c.label}</span>
          {colors[c.id] && (
            <button
              type="button"
              className="link small"
              onClick={() => {
                const next = { ...colors }
                delete next[c.id]
                set(next)
              }}
            >
              Reset
            </button>
          )}
        </label>
      ))}
      {Object.keys(colors).length > 0 && (
        <button type="button" className="link small" onClick={() => set({})}>
          Back to the usual colors
        </button>
      )}
    </fieldset>
  )
}

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
