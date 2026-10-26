import { useState } from 'react'
import { useLocations } from '../../firebase/location'
import { useApp } from '../../hooks/useApp'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { agoText, STALE_MS } from '../../utils/location'
import { people } from '../../utils/tasks'
import { SectionHeader } from '../UI/SectionHeader'

/** Family Map on the Today page (members only): when opened, each person's last report; Open map for the map. */
export function FamilyMapStrip() {
  const { isMember, navigate } = useApp()
  const [open, setOpen] = useStoredFlag('align-today-map', false)
  if (!isMember) return null
  return (
    <div className="day-section map-strip">
      <SectionHeader icon="map" title="Family Map" onTitleClick={() => setOpen(!open)} expanded={open} help="map">
        <button type="button" className="link small" onClick={() => navigate({ view: 'map' })}>
          Open map
        </button>
        <button type="button" className="link small" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'}
        </button>
      </SectionHeader>
      {open && <WhoIsWhere />}
    </div>
  )
}

/** Listening to locations only while open, so a folded section costs no reads. */
function WhoIsWhere() {
  const app = useApp()
  const { locations, error } = useLocations()
  const [now] = useState(() => Date.now())
  const byUid = new Map(locations.map((l) => [l.uid, l]))
  if (error) return <p className="error small">{error}</p>
  return (
    <ul className="map-people small">
      {people(app.household, true).map(([uid, m]) => {
        const loc = byUid.get(uid)
        const at = loc && typeof loc.tst === 'number' ? loc.tst : undefined
        return (
          <li key={uid} className={`map-person${at && now - at > STALE_MS ? ' stale' : ''}`}>
            <span className="map-dot" style={{ background: m.color }} aria-hidden="true" />
            <span className="grow">
              <strong>{m.displayName}</strong>{' '}
              <span className="muted">{loc?.off ? 'paused' : at ? [agoText(at, now), loc?.batt !== undefined ? `${loc.batt}% battery` : ''].filter(Boolean).join(' · ') : 'not sharing'}</span>
            </span>
            {at && (
              <button type="button" className="link small" onClick={() => app.navigate({ view: 'map' })}>
                Show
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
