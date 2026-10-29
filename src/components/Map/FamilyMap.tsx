import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { deleteMyLocation, getLocationKey, setSharing, useLocations } from '../../firebase/location'
import { calendarSyncUrl } from '../../firebase/calendarSync'
import { useApp } from '../../hooks/useApp'
import { agoText, cleanTrail, directionsUrl, eventText, initialsOf, MAX_ACCURACY, metersText, ownTracksSetupLink, reportUrl, STALE_MS, type FamilyLocation, type Place } from '../../utils/location'
import { usePlaces } from '../../firebase/places'
import { AlertsPanel, PlacesPanel, type PlaceDraft } from './MapPlaces'
import { people } from '../../utils/tasks'
import { HelpTip } from '../UI/HelpTip'
import { Icon } from '../UI/Icon'

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
// Winter Park, FL, until someone has a position.
const HOME: L.LatLngTuple = [28.6, -81.35]

const placed = (l?: FamilyLocation): l is FamilyLocation & { lat: number; lon: number; tst: number } => !!l && typeof l.lat === 'number' && typeof l.lon === 'number' && typeof l.tst === 'number'

/**
 * #/map (DESIGN.md §5.11): where everyone sharing is, on an OpenStreetMap map: a colored pin per person (faded when
 * it's old), the accuracy circle, and on request their trail for the last day. Below: each person's last report with
 * Directions, places (geofences: who's where, + Add place), your alerts, and your own sharing (set up OwnTracks,
 * pause, resume, delete). Members only.
 */
export default function FamilyMap() {
  const { isMember } = useApp()
  if (!isMember) return <p className="muted">The family map is for household members.</p>
  return <MapPage />
}

function MapPage() {
  const app = useApp()
  const { locations, error } = useLocations()
  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const fitted = useRef(false)
  const [trailFor, setTrailFor] = useState<string | null>(null)
  const places = usePlaces()
  const [draft, setDraft] = useState<PlaceDraft | null>(null)
  const [picking, setPicking] = useState(false)
  // The map's click and the draft pin's drag reach the latest state through refs (Leaflet handlers are set once).
  const pickRef = useRef<(lat: number, lon: number) => void>(() => undefined)
  useEffect(() => {
    pickRef.current = (lat, lon) => {
      if (picking && draft) {
        setDraft({ ...draft, lat, lon })
        setPicking(false)
      }
    }
  })
  const dragRef = useRef<(lat: number, lon: number) => void>(() => undefined)
  useEffect(() => {
    dragRef.current = (lat, lon) => draft && setDraft({ ...draft, lat, lon })
  })
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const family = people(app.household, true)
  const byUid = new Map(locations.map((l) => [l.uid, l]))

  // The map itself, once.
  useEffect(() => {
    if (!mapEl.current || map.current) return
    map.current = L.map(mapEl.current, { zoomControl: true }).setView(HOME, 11)
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map.current)
    layer.current = L.layerGroup().addTo(map.current)
    map.current.on('click', (e: L.LeafletMouseEvent) => pickRef.current(e.latlng.lat, e.latlng.lng))
    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  // Pins, accuracy circles and the chosen trail, redrawn as reports arrive.
  useEffect(() => {
    const m = map.current
    const g = layer.current
    if (!m || !g) return
    g.clearLayers()
    const points: L.LatLngTuple[] = []
    // Places: a dashed circle and their name (the one being edited is drawn from the draft instead).
    for (const p of places) {
      if (draft?.id === p.id) continue
      L.circle([p.lat, p.lon], { radius: p.radius, color: '#57606a', weight: 1.5, dashArray: '4 4', fillOpacity: 0.05, interactive: false })
        .bindTooltip(p.name, { permanent: true, direction: 'center', className: 'place-label' })
        .addTo(g)
    }
    if (draft) {
      L.circle([draft.lat, draft.lon], { radius: draft.radius, color: '#1f6feb', weight: 2, fillOpacity: 0.12, interactive: false }).addTo(g)
      const pin = L.marker([draft.lat, draft.lon], { draggable: true, title: 'Drag to move the place' }).addTo(g)
      pin.on('dragend', () => dragRef.current(pin.getLatLng().lat, pin.getLatLng().lng))
    }
    for (const [uid, member] of family) {
      const loc = byUid.get(uid)
      if (!placed(loc)) continue
      const at: L.LatLngTuple = [loc.lat, loc.lon]
      points.push(at)
      const stale = now - loc.tst > STALE_MS
      // A rough fix (cell tower / Wi-Fi) keeps its pin but shows it plainly: faded, with a dashed accuracy circle.
      const rough = !!loc.acc && loc.acc > MAX_ACCURACY
      if (loc.acc && loc.acc < 5000) L.circle(at, { radius: loc.acc, color: member.color, weight: 1, fillOpacity: rough ? 0.04 : 0.08, dashArray: rough ? '6 6' : undefined }).addTo(g)
      if (trailFor === uid && loc.trail?.length) {
        const path = cleanTrail([...loc.trail, { lat: loc.lat, lon: loc.lon, tst: loc.tst, acc: loc.acc }])
        L.polyline(path.map((t): L.LatLngTuple => [t.lat, t.lon]), { color: member.color, weight: 3, opacity: 0.7 }).addTo(g)
      }
      const icon = L.divIcon({
        className: '',
        html: `<span class="map-pin${stale || rough ? ' stale' : ''}" style="background:${member.color}">${initialsOf(member.displayName).slice(0, 1)}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      })
      const text = [member.displayName, agoText(loc.tst, now), rough ? `rough position ±${metersText(loc.acc!)}` : '', loc.batt !== undefined ? `battery ${loc.batt}%` : '', loc.off ? 'paused' : ''].filter(Boolean).join(' · ')
      L.marker(at, { icon, title: member.displayName }).bindTooltip(text).addTo(g)
    }
    // Frame everyone the first time there's anyone to show.
    if (points.length && !fitted.current) {
      fitted.current = true
      m.fitBounds(L.latLngBounds(points).pad(0.3), { maxZoom: 15 })
    }
  })

  const center = (loc: FamilyLocation) => placed(loc) && map.current?.setView([loc.lat, loc.lon], 15)
  // Opened for one person (#/map/<uid>, e.g. tapping their name on Today): center on them once their position loads.
  const focusFor = app.route.view === 'map' ? app.route.person : undefined
  const focused = useRef<string | null>(null)
  useEffect(() => {
    const loc = focusFor ? byUid.get(focusFor) : undefined
    if (!focusFor || focused.current === focusFor || !placed(loc) || !map.current) return
    focused.current = focusFor
    fitted.current = true // don't then reframe on everyone
    map.current.setView([loc.lat, loc.lon], 15)
  })
  const showPlace = (p: Place) => map.current?.fitBounds(L.latLng(p.lat, p.lon).toBounds(p.radius * 2.5))
  // Keep the place being edited in view as it moves (Here, an address, a tap).
  useEffect(() => {
    if (draft) map.current?.fitBounds(L.latLng(draft.lat, draft.lon).toBounds(draft.radius * 2.5), { maxZoom: 17 })
  }, [draft?.lat, draft?.lon]) // eslint-disable-line react-hooks/exhaustive-deps
  // "Tap the map" from the editor below: bring the map into view.
  useEffect(() => {
    if (picking) mapEl.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [picking])
  const placeNames = (ids?: string[]) => (ids ?? []).map((id) => places.find((p) => p.id === id)?.name).filter(Boolean)

  return (
    <section className="family-map">
      <header className="view-header">
        <h2>Family Map</h2>
        <HelpTip topic="map" label="Family Map" />
      </header>
      {error && <p className="error small">{error}</p>}
      {/* Leaflet adds its own classes to the map element, so React must never re-render its className. */}
      <div className={picking ? 'map-picking' : undefined}>
        <div ref={mapEl} className="map-box" role="region" aria-label="Map of where everyone is" />
      </div>
      {picking && <p className="small map-pick-hint">Tap the map where the place is.</p>}

      <ul className="map-people">
        {family.map(([uid, member]) => {
          const loc = byUid.get(uid)
          const where = placed(loc)
          return (
            <li key={uid} className={`map-person${where && now - loc.tst > STALE_MS ? ' stale' : ''}${focusFor === uid ? ' focused' : ''}`}>
              <span className="map-dot" style={{ background: member.color }} aria-hidden="true" />
              <span className="grow">
                <strong>{member.displayName}</strong>{' '}
                <span className="muted small">
                  {where
                    ? [placeNames(loc.inside).length ? `at ${placeNames(loc.inside).join(', ')}` : '', loc.events?.length ? eventText(loc.events[loc.events.length - 1]) : '', agoText(loc.tst, now), loc.batt !== undefined ? `${loc.batt}% battery` : '', loc.acc ? (loc.acc > MAX_ACCURACY ? `rough position ±${metersText(loc.acc)}` : `±${loc.acc} m`) : '', loc.off ? 'paused' : ''].filter(Boolean).join(' · ')
                    : loc?.off
                      ? 'paused'
                      : 'not sharing'}
                </span>
              </span>
              {where && (
                <>
                  <button type="button" className="link small" onClick={() => center(loc)}>
                    Show
                  </button>
                  {!!loc.trail?.length && (
                    <button type="button" className="link small" onClick={() => setTrailFor(trailFor === uid ? null : uid)} aria-pressed={trailFor === uid}>
                      {trailFor === uid ? 'Hide trail' : 'Trail'}
                    </button>
                  )}
                  <a className="link small" href={directionsUrl(loc.lat, loc.lon)} target="_blank" rel="noopener noreferrer">
                    Directions <Icon name="external" />
                  </a>
                </>
              )}
            </li>
          )
        })}
      </ul>

      <PlacesPanel
        places={places}
        locations={locations}
        draft={draft}
        setDraft={setDraft}
        picking={picking}
        setPicking={setPicking}
        newCenter={() => {
          const c = map.current?.getCenter()
          return c ? { lat: c.lat, lon: c.lng } : { lat: HOME[0], lon: HOME[1] }
        }}
        onShow={showPlace}
      />
      <AlertsPanel places={places} />
      <MySharing mine={byUid.get(app.uid)} />
    </section>
  )
}

/** Your own sharing: set up OwnTracks with your personal link, then pause / resume, or delete your position. */
function MySharing({ mine }: { mine?: FamilyLocation }) {
  const app = useApp()
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const name = app.household.members[app.uid]?.displayName ?? 'Me'
  const fail = (err: unknown) => setError(err instanceof Error ? err.message : String(err))

  async function setUp() {
    setBusy(true)
    setError(null)
    try {
      const r = await getLocationKey()
      if (!r.ok || !r.key) setError(r.error ?? 'That didn’t work.')
      else setLink(reportUrl(calendarSyncUrl!, r.key))
    } catch (err) {
      fail(err)
    }
    setBusy(false)
  }

  return (
    <div className="day-section map-mine">
      <h3>Your location</h3>
      <p className="muted small">
        {mine?.off
          ? 'Paused: your phone’s reports are ignored, and everyone sees your last position as paused.'
          : placed(mine)
            ? `Sharing: last report ${agoText(mine.tst)}.`
            : 'Not sharing yet. The free OwnTracks app on your phone reports where you are (in the background, battery-friendly) to the family only.'}
      </p>
      <div className="row wrap">
        <button type="button" className="small" onClick={setUp} disabled={busy}>
          <Icon name="phone" /> {busy ? 'Getting your link…' : placed(mine) ? 'Set up another phone' : 'Set up my phone'}
        </button>
        {mine && (
          <button type="button" className="secondary small" onClick={() => setSharing(app.uid, !!mine.off).catch(fail)}>
            {mine.off ? 'Resume sharing' : 'Pause sharing'}
          </button>
        )}
        {mine && (
          <button
            type="button"
            className="link small danger-text"
            onClick={() => window.confirm('Delete your position and trail from Align? (Pause first, or turn OwnTracks off, or your phone will start it again.)') && deleteMyLocation(app.uid).catch(fail)}
          >
            Delete my location
          </button>
        )}
      </div>
      {error && <p className="error small">{error}</p>}
      {link && (
        <div className="map-setup">
          <ol className="small">
            <li>
              Install <strong>OwnTracks</strong> (free) on your phone: <a href="https://apps.apple.com/app/owntracks/id692424691" target="_blank" rel="noopener noreferrer">iPhone</a> ·{' '}
              <a href="https://play.google.com/store/apps/details?id=org.owntracks.android" target="_blank" rel="noopener noreferrer">Android</a>.
            </li>
            <li>
              On the phone, open this page and tap{' '}
              <a className="button-link small" href={ownTracksSetupLink(link, name)}>
                Set up OwnTracks
              </a>{' '}
              (it fills in everything).
            </li>
            <li>When asked, allow location <strong>Always</strong> (iPhone: “Always”; Android: “Allow all the time”), so it works with the app closed.</li>
          </ol>
          <details className="small">
            <summary>Set it up by hand instead</summary>
            <p>
              In OwnTracks → Settings (Preferences) → Connection: Mode <strong>HTTP</strong>, and this URL (it’s yours alone; don’t share it):
            </p>
            <div className="row">
              <input className="grow" readOnly value={link} aria-label="Your OwnTracks address" onFocus={(e) => e.target.select()} />
              <button
                type="button"
                className="secondary small"
                onClick={() =>
                  navigator.clipboard
                    .writeText(link)
                    .then(() => setCopied(true))
                    .catch(fail)
                }
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p>Monitoring: “Significant” saves battery; “Move” reports every few seconds while you travel.</p>
          </details>
        </div>
      )}
    </div>
  )
}
