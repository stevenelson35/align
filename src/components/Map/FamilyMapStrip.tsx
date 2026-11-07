import { useState } from 'react'
import { useLocations } from '../../firebase/location'
import { usePlaces } from '../../firebase/places'
import { useApp } from '../../hooks/useApp'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { agoText, eventText, STALE_MS, stuckSince } from '../../utils/location'
import { people } from '../../utils/tasks'
import { SectionHeader } from '../UI/SectionHeader'
import { useTodayExpansion } from '../../hooks/useTodaySection'
import { CollectionContents, PinButton } from '../UI/CollectionSection'
import { usePinned } from '../../hooks/usePinned'

/** Family Map on Today (members only): pinned people, search and everyone's last report; Open map for the map. */
export function FamilyMapStrip() {
  const { isMember, navigate } = useApp()
  const [open, saveOpen] = useStoredFlag('align-today-map', false)
  const setOpen = useTodayExpansion(open, saveOpen)
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
  const pins = usePinned()
  const [pinError, setPinError] = useState<string | null>(null)
  const [now] = useState(() => Date.now())
  const places = usePlaces()
  const at = (ids?: string[]) => (ids ?? []).map((id) => places.find((p) => p.id === id)?.name).filter(Boolean).join(', ')
  const byUid = new Map(locations.map((l) => [l.uid, l]))
  const members = people(app.household, true)
  const pinId = (uid: string) => `map-person:${uid}`
  return (
    <CollectionContents
      id="map"
      title="Family Map"
      items={members}
      pinned={members.filter(([uid]) => pins.isPinned(pinId(uid))).sort(([a], [b]) => pins.order(pinId(a)) - pins.order(pinId(b)))}
      itemKey={([uid]) => uid}
      matches={([, m], q) => q.toLowerCase().split(/\s+/).every((word) => m.displayName.toLowerCase().includes(word))}
      searchHint="Find a family member…"
      filters={<>{error && <p className="error small">{error}</p>}{pinError && <p className="error small">{pinError}</p>}</>}
      render={([uid, m]) => {
        const loc = byUid.get(uid)
        const tst = loc && typeof loc.tst === 'number' ? loc.tst : undefined
        return (
          <div className={`collection-row map-person small${tst && now - tst > STALE_MS ? ' stale' : ''}`}>
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
              {loc && stuckSince(loc, now) && <span className="map-stuck small">Location not updating: see the map</span>}
            </span>
            {tst && (
              <button type="button" className="link small" onClick={() => app.navigate({ view: 'map', person: uid })}>
                Show
              </button>
            )}
            <PinButton pinned={pins.isPinned(pinId(uid))} onToggle={() => {
              setPinError(null)
              void pins.toggle(pinId(uid)).catch((err: unknown) => setPinError(err instanceof Error ? err.message : String(err)))
            }} label={m.displayName} />
          </div>
        )
      }}
    />
  )
}
