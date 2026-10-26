import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { deleteMyLocation, getLocationKey, setSharing, useLocations } from '../../firebase/location'
import { calendarSyncUrl } from '../../firebase/calendarSync'
import { useApp } from '../../hooks/useApp'
import { agoText, directionsUrl, initialsOf, ownTracksSetupLink, reportUrl, STALE_MS, type FamilyLocation } from '../../utils/location'
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
 * Directions, and your own sharing (set up OwnTracks, pause, resume, delete). Members only.
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
    for (const [uid, member] of family) {
      const loc = byUid.get(uid)
      if (!placed(loc)) continue
      const at: L.LatLngTuple = [loc.lat, loc.lon]
      points.push(at)
      const stale = now - loc.tst > STALE_MS
      if (loc.acc && loc.acc < 2000) L.circle(at, { radius: loc.acc, color: member.color, weight: 1, fillOpacity: 0.08 }).addTo(g)
      if (trailFor === uid && loc.trail?.length) {
        L.polyline([...loc.trail.map((t): L.LatLngTuple => [t.lat, t.lon]), at], { color: member.color, weight: 3, opacity: 0.7 }).addTo(g)
      }
      const icon = L.divIcon({
        className: '',
        html: `<span class="map-pin${stale ? ' stale' : ''}" style="background:${member.color}">${initialsOf(member.displayName).slice(0, 1)}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      })
      const text = [member.displayName, agoText(loc.tst, now), loc.batt !== undefined ? `battery ${loc.batt}%` : '', loc.off ? 'paused' : ''].filter(Boolean).join(' · ')
      L.marker(at, { icon, title: member.displayName }).bindTooltip(text).addTo(g)
    }
    // Frame everyone the first time there's anyone to show.
    if (points.length && !fitted.current) {
      fitted.current = true
      m.fitBounds(L.latLngBounds(points).pad(0.3), { maxZoom: 15 })
    }
  })

  const center = (loc: FamilyLocation) => placed(loc) && map.current?.setView([loc.lat, loc.lon], 15)

  return (
    <section className="family-map">
      <header className="view-header">
        <h2>Family Map</h2>
        <HelpTip topic="map" label="Family Map" />
      </header>
      {error && <p className="error small">{error}</p>}
      <div ref={mapEl} className="map-box" role="region" aria-label="Map of where everyone is" />

      <ul className="map-people">
        {family.map(([uid, member]) => {
          const loc = byUid.get(uid)
          const where = placed(loc)
          return (
            <li key={uid} className={`map-person${where && now - loc.tst > STALE_MS ? ' stale' : ''}`}>
              <span className="map-dot" style={{ background: member.color }} aria-hidden="true" />
              <span className="grow">
                <strong>{member.displayName}</strong>{' '}
                <span className="muted small">
                  {where
                    ? [agoText(loc.tst, now), loc.batt !== undefined ? `${loc.batt}% battery` : '', loc.acc ? `±${loc.acc} m` : '', loc.off ? 'paused' : ''].filter(Boolean).join(' · ')
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
