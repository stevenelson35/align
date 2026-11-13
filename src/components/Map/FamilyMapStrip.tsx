import { useEffect, useState, type ReactNode } from 'react'
import { useLocations } from '../../firebase/location'
import { usePlaces } from '../../firebase/places'
import { useApp } from '../../hooks/useApp'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { agoText, eventText, STALE_MS, stuckSince, type FamilyLocation } from '../../utils/location'
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
  const now = useNow()
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
      render={([uid, m]) => (
        <MapPersonRow uid={uid} name={m.displayName} color={m.color} loc={byUid.get(uid)} now={now} at={at}>
          <PinButton pinned={pins.isPinned(pinId(uid))} onToggle={() => {
            setPinError(null)
            void pins.toggle(pinId(uid)).catch((err: unknown) => setPinError(err instanceof Error ? err.message : String(err)))
          }} label={m.displayName} />
        </MapPersonRow>
      )}
    />
  )
}

/** Ticks every half minute, for "location 3 min ago". */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

/** One person: where they are, when they last reported, battery; Show opens the map on them. */
function MapPersonRow({ uid, name, color, loc, now, at, children }: { uid: string; name: string; color: string; loc?: FamilyLocation; now: number; at: (ids?: string[]) => string; children?: ReactNode }) {
  const app = useApp()
  const tst = loc && typeof loc.tst === 'number' ? loc.tst : undefined
  const lastEvent = loc?.events?.[loc.events.length - 1]
  return (
    <div className={`collection-row map-person small${tst && now - tst > STALE_MS ? ' stale' : ''}`}>
      <span className="map-dot" style={{ background: color }} aria-hidden="true" />
      <span className="grow">
        {tst ? (
          <button type="button" className="link map-person-name" onClick={() => app.navigate({ view: 'map', person: uid })} title={`Show ${name} on the map`}>
            <strong>{name}</strong>
          </button>
        ) : (
          <strong>{name}</strong>
        )}{' '}
        <span className="muted">
          {loc?.off
            ? 'paused'
            : tst
              ? [at(loc?.inside) ? `at ${at(loc?.inside)}` : '', lastEvent ? eventText(lastEvent, now) : '', lastEvent ? `location ${agoText(tst, now)}` : agoText(tst, now), loc?.batt !== undefined ? `${loc.batt}% battery` : ''].filter(Boolean).join(' · ')
              : 'not sharing'}
        </span>
        {loc && stuckSince(loc, now) && <span className="map-stuck small">Location not updating: see the map</span>}
      </span>
      {tst && (
        <button type="button" className="link small" onClick={() => app.navigate({ view: 'map', person: uid })}>
          Show
        </button>
      )}
      {children}
    </div>
  )
}

/** One person's location as a Today tile (members only; listens to locations only while shown). */
export function PersonLocationTile({ uid }: { uid: string }) {
  const app = useApp()
  const { locations, error } = useLocations()
  const places = usePlaces()
  const now = useNow()
  const m = app.household.members[uid]
  if (!m) return <p className="muted small">Someone no longer in the family.</p>
  const at = (ids?: string[]) => (ids ?? []).map((id) => places.find((p) => p.id === id)?.name).filter(Boolean).join(', ')
  return (
    <div className="day-section tile-person">
      <MapPersonRow uid={uid} name={m.displayName} color={m.color} loc={locations.find((l) => l.uid === uid)} now={now} at={at} />
      {error && <p className="error small">{error}</p>}
    </div>
  )
}
