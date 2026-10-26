import { useEffect, useState, type FormEvent } from 'react'
import { auth } from '../../firebase/config'
import { deletePlace, disablePushHere, enablePushHere, findAddress, pushProblem, pushTokenHere, saveAlertPrefs, savePlace, useAlertPrefs } from '../../firebase/places'
import { useApp } from '../../hooks/useApp'
import { metersText, parseLatLon, RADIUS, type AlertRule, type FamilyLocation, type Place } from '../../utils/location'
import { people } from '../../utils/tasks'
import { Icon } from '../UI/Icon'

/** A place being added or changed: a name, a center (once chosen) and a radius. */
export interface PlaceDraft {
  id?: string
  name: string
  lat: number
  lon: number
  radius: number
}

/**
 * Places (geofences): the list, with who's at each now, and + Add place. The center can be Here (this device's
 * location), a tap on the map (or dragging the pin), or an address or "lat, lon" typed in; the radius is a slider.
 */
export function PlacesPanel({
  places,
  locations,
  draft,
  setDraft,
  picking,
  setPicking,
  newCenter,
  onShow,
}: {
  places: Place[]
  locations: FamilyLocation[]
  draft: PlaceDraft | null
  setDraft: (d: PlaceDraft | null) => void
  picking: boolean
  setPicking: (on: boolean) => void
  /** Where a new place starts: the middle of the map. */
  newCenter: () => { lat: number; lon: number }
  onShow: (p: Place) => void
}) {
  const app = useApp()
  const atPlace = (id: string) =>
    locations
      .filter((l) => l.inside?.includes(id) && !l.off)
      .map((l) => app.household.members[l.uid]?.displayName)
      .filter(Boolean)
  return (
    <div className="day-section map-places">
      <h3 className="row">
        <span className="grow">
          <Icon name="map" /> Places
        </span>
        {!draft && (
          <button type="button" className="secondary small" onClick={() => setDraft({ name: '', radius: RADIUS.default, ...newCenter() })}>
            <Icon name="plus" /> Add place
          </button>
        )}
      </h3>
      {draft && <PlaceEditor draft={draft} setDraft={setDraft} picking={picking} setPicking={setPicking} />}
      {!places.length && !draft && <p className="muted small">No places yet. Add Home, School, Work… to see who’s there and, if you like, get an alert when someone arrives or leaves.</p>}
      <ul className="map-people">
        {places.map((p) => {
          const here = atPlace(p.id)
          return (
            <li key={p.id} className="map-person">
              <span className="grow">
                <strong>{p.name}</strong> <span className="muted small">{metersText(p.radius)} around · {here.length ? `${here.join(', ')} ${here.length > 1 ? 'are' : 'is'} here` : 'nobody here now'}</span>
              </span>
              <button type="button" className="link small" onClick={() => onShow(p)}>
                Show
              </button>
              <button type="button" className="link small" onClick={() => setDraft({ ...p })} disabled={!!draft}>
                Edit
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function PlaceEditor({ draft, setDraft, picking, setPicking }: { draft: PlaceDraft; setDraft: (d: PlaceDraft | null) => void; picking: boolean; setPicking: (on: boolean) => void }) {
  const app = useApp()
  const [where, setWhere] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<PlaceDraft>) => setDraft({ ...draft, ...patch })
  const fail = (err: unknown) => setError(err instanceof Error ? err.message : String(err))

  function here() {
    setError(null)
    if (!navigator.geolocation) return setError('This browser can’t tell where it is.')
    setNote('Finding where you are…')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setNote(`Centered where this device is (±${Math.round(pos.coords.accuracy)} m).`)
      },
      (err) => {
        setNote(null)
        setError(err.code === err.PERMISSION_DENIED ? 'Location isn’t allowed for Align in this browser.' : 'Couldn’t find where this device is.')
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  async function find(e?: FormEvent) {
    e?.preventDefault()
    setError(null)
    const typed = parseLatLon(where)
    if (typed) {
      set(typed)
      return setNote('Centered on those coordinates.')
    }
    if (!where.trim()) return
    setNote('Looking up the address…')
    try {
      const hit = await findAddress(where)
      if (!hit) return setNote('No match for that address; try adding the city, or tap the map instead.')
      set({ lat: hit.lat, lon: hit.lon, name: draft.name || where.split(',')[0].trim() })
      setNote(`Found: ${hit.label}`)
    } catch (err) {
      setNote(null)
      fail(err)
    }
  }

  async function save() {
    if (!draft.name.trim()) return setError('Give the place a name.')
    setBusy(true)
    try {
      await savePlace(draft, app.uid)
      setDraft(null)
      setPicking(false)
    } catch (err) {
      fail(err)
    }
    setBusy(false)
  }

  async function remove() {
    if (!draft.id || !window.confirm(`Delete the place “${draft.name}”? Alerts for it stop.`)) return
    await deletePlace(draft.id).catch(fail)
    setDraft(null)
  }

  return (
    <div className="place-editor form">
      <label>
        Name
        <input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Home, School, Grandma’s…" maxLength={60} autoFocus />
      </label>
      <div className="place-where">
        <span className="label">Where</span>
        <div className="row wrap">
          <button type="button" className="secondary small" onClick={here}>
            <Icon name="map" /> Here
          </button>
          <button
            type="button"
            className={`small ${picking ? '' : 'secondary'}`}
            onClick={() => {
              setNote(null)
              setPicking(!picking)
            }}
            aria-pressed={picking}
          >
            {picking ? 'Tap the map now…' : 'Tap the map'}
          </button>
          <span className="muted small">or drag the pin</span>
        </div>
        <form className="row" onSubmit={find}>
          <input className="grow" value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Address, or lat, lon (28.60, -81.35)" aria-label="Address or coordinates" />
          <button type="submit" className="secondary small" disabled={!where.trim()}>
            Find
          </button>
        </form>
        <p className="muted small">
          Center {draft.lat.toFixed(5)}, {draft.lon.toFixed(5)}
          {note ? ` · ${note}` : ''}
        </p>
      </div>
      <label>
        Radius: {metersText(draft.radius)}
        <input type="range" min={RADIUS.min} max={RADIUS.max} step={10} value={draft.radius} onChange={(e) => set({ radius: Number(e.target.value) })} />
      </label>
      <p className="muted small">Phones report about every few hundred meters of travel, so 150 m or more works best; a school or park may need 300 m.</p>
      {error && <p className="error small">{error}</p>}
      <div className="row">
        <button type="button" className="small" onClick={save} disabled={busy}>
          {draft.id ? 'Save' : 'Add place'}
        </button>
        <button
          type="button"
          className="secondary small"
          onClick={() => {
            setDraft(null)
            setPicking(false)
          }}
        >
          Cancel
        </button>
        <span className="grow" />
        {draft.id && (
          <button type="button" className="danger small" onClick={remove}>
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

const WHEN = [
  { value: 'enter', label: 'arrives at' },
  { value: 'leave', label: 'leaves' },
  { value: 'both', label: 'arrives at or leaves' },
] as const

/**
 * Your alerts: "Alert me when Daughter arrives at School". Delivered as notifications on the devices you turn them
 * on for (iPhone: from Align on the Home Screen) and/or by email. Only you see your alerts.
 */
export function AlertsPanel({ places }: { places: Place[] }) {
  const app = useApp()
  const prefs = useAlertPrefs(app.uid)
  const [person, setPerson] = useState('*')
  const [place, setPlace] = useState('*')
  const [when, setWhen] = useState<(typeof WHEN)[number]['value']>('enter')
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const token = pushTokenHere()
  const pushOn = !!token && prefs.push.includes(token)
  const email = auth.currentUser?.email ?? ''
  const others = people(app.household, true).filter(([id]) => id !== app.uid)
  const fail = (err: unknown) => setError(err instanceof Error ? err.message : String(err))
  useEffect(() => {
    void pushProblem().then(setProblem)
  }, [])

  const placeName = (id: string) => (id === '*' ? 'any place' : (places.find((p) => p.id === id)?.name ?? 'a deleted place'))
  const personName = (id: string) => (id === '*' ? 'anyone' : (app.household.members[id]?.displayName ?? 'someone'))
  const ruleText = (r: AlertRule) => `${personName(r.person)} ${r.enter && r.leave ? 'arrives at or leaves' : r.enter ? 'arrives at' : 'leaves'} ${placeName(r.place)}`

  function addRule(e: FormEvent) {
    e.preventDefault()
    const rule: AlertRule = { person, place, enter: when !== 'leave', leave: when !== 'enter' }
    if (prefs.rules.some((r) => r.person === rule.person && r.place === rule.place && r.enter === rule.enter && r.leave === rule.leave)) return
    saveAlertPrefs(app.uid, { rules: [...prefs.rules, rule] }).catch(fail)
  }

  async function togglePush() {
    setBusy(true)
    setError(null)
    try {
      if (pushOn) await disablePushHere(app.uid, prefs.push)
      else await enablePushHere(app.uid, prefs.push)
    } catch (err) {
      fail(err)
    }
    setBusy(false)
  }

  return (
    <div className="day-section map-alerts">
      <h3>
        <Icon name="warning" /> Alerts for me
      </h3>
      <p className="muted small">Only you see your alerts. They come from each phone’s OwnTracks reports, so they can lag a few minutes behind.</p>
      {prefs.rules.length > 0 && (
        <ul className="map-people">
          {prefs.rules.map((r, i) => (
            <li key={i} className="map-person">
              <span className="grow">Alert me when {ruleText(r)}</span>
              <button type="button" className="link small" onClick={() => saveAlertPrefs(app.uid, { rules: prefs.rules.filter((_, j) => j !== i) }).catch(fail)} aria-label={`Remove: ${ruleText(r)}`}>
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {places.length ? (
        <form className="row wrap alert-add" onSubmit={addRule}>
          <span className="small">Alert me when</span>
          <select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Who">
            <option value="*">anyone</option>
            {others.map(([id, m]) => (
              <option key={id} value={id}>
                {m.displayName}
              </option>
            ))}
          </select>
          <select value={when} onChange={(e) => setWhen(e.target.value as typeof when)} aria-label="Arrives or leaves">
            {WHEN.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
          <select value={place} onChange={(e) => setPlace(e.target.value)} aria-label="Which place">
            <option value="*">any place</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="submit" className="secondary small">
            <Icon name="plus" /> Add
          </button>
        </form>
      ) : (
        <p className="muted small">Add a place first.</p>
      )}
      <div className="alert-channels">
        <div className="row wrap">
          <span className="grow small">
            Notifications on this device: <strong>{pushOn ? 'on' : 'off'}</strong>
            {prefs.push.length > (pushOn ? 1 : 0) && <span className="muted"> ({prefs.push.length - (pushOn ? 1 : 0)} other device{prefs.push.length - (pushOn ? 1 : 0) > 1 ? 's' : ''} on)</span>}
          </span>
          <button type="button" className="secondary small" onClick={togglePush} disabled={busy || (!pushOn && !!problem)}>
            {busy ? '…' : pushOn ? 'Turn off here' : 'Turn on here'}
          </button>
        </div>
        {!pushOn && problem && <p className="muted small">{problem}</p>}
        {email && (
          <label className="inline small">
            <input type="checkbox" checked={!!prefs.emailOn} onChange={(e) => saveAlertPrefs(app.uid, { emailOn: e.target.checked, email }).catch(fail)} />
            Also email me at {email}
          </label>
        )}
        {prefs.rules.length > 0 && !prefs.push.length && !prefs.emailOn && <p className="error small">Turn on notifications or email, or these alerts have nowhere to go.</p>}
      </div>
      {error && <p className="error small">{error}</p>}
    </div>
  )
}
