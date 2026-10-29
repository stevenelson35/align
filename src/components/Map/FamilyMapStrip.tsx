import { useState } from 'react'
import { useLocations } from '../../firebase/location'
import { usePlaces } from '../../firebase/places'
import { useApp } from '../../hooks/useApp'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { agoText, eventText, STALE_MS } from '../../utils/location'
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
  const places = usePlaces()
  const at = (ids?: string[]) => (ids ?? []).map((id) => places.find((p) => p.id === id)?.name).filter(Boolean).join(', ')
  const byUid = new Map(locations.map((l) => [l.uid, l]))
  if (error) return <p className="error small">{error}</p>
  return (
    <ul className="map-people small">
      {people(app.household, true).map(([uid, m]) => {
        const loc = byUid.get(uid)
        const tst = loc && typeof loc.tst === 'number' ? loc.tst : undefined
        return (
          <li key={uid} className={`map-person${tst && now - tst > STALE_MS ? ' stale' : ''}`}>
            <span className="map-dot" style={{ background: m.color }} aria-hidden="true" />
            <span className="grow">
              {tst ? (
                <button type="button" className="link map-person-name" onClick={() => app.navigate({ view: 'map', person: uid })} title={`Show ${m.displayName} on the map`}>
                  <strong>{m.displayName}</strong>
                </button>
              ) : (
                <strong>{m.displayName}</strong>
              )}{' '}
              <span className="muted">
                {loc?.off
                  ? 'paused'
                  : tst
                    ? [at(loc?.inside) ? `at ${at(loc?.inside)}` : '', loc?.events?.length ? eventText(loc.events[loc.events.length - 1]) : '', agoText(tst, now), loc?.batt !== undefined ? `${loc.batt}% battery` : ''].filter(Boolean).join(' · ')
                    : 'not sharing'}
              </span>
            </span>
            {tst && (
              <button type="button" className="link small" onClick={() => app.navigate({ view: 'map', person: uid })}>
                Show
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
