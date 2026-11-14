import { useEffect, useState } from 'react'
import { useLocations } from '../firebase/location'
import { usePlaces } from '../firebase/places'
import { agoText } from '../utils/location'

/**
 * Where a family member is, in a few words for a row ("at Home · 5 min ago", "away · 2 h ago", "paused", "not
 * sharing"). Listens to the family map's locations (members only; the rules refuse everyone else).
 */
export function useMemberLocation(uid: string): string {
  const { locations } = useLocations()
  const places = usePlaces()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  const loc = locations.find((l) => l.uid === uid)
  if (!loc) return 'not sharing'
  if (loc.off) return 'location paused'
  const tst = typeof loc.tst === 'number' ? loc.tst : undefined
  if (!tst) return 'not sharing'
  const at = (loc.inside ?? []).map((id) => places.find((p) => p.id === id)?.name).filter(Boolean).join(', ')
  return `${at ? `at ${at}` : 'away'} · ${agoText(tst, now)}`
}
