import { useMemo } from 'react'
import { useLocations } from '../firebase/location'
import type { Task } from '../types'
import { memberForContact } from '../utils/contacts'
import { useApp } from './useApp'

/**
 * Which contacts are family members on the family map (they have an Align account and their phone has reported a
 * location): contact → their uid, or null. One listener for a whole list of contacts; members only.
 */
export function useFamilyOnMap(): (contact: Pick<Task, 'title' | 'contact'>) => string | null {
  const app = useApp()
  const { locations } = useLocations(app.isMember)
  const onMap = useMemo(() => new Set(locations.filter((l) => typeof l.tst === 'number').map((l) => l.uid)), [locations])
  const members = app.household.members
  return useMemo(
    () => (contact) => {
      if (!app.isMember || !onMap.size) return null
      const uid = memberForContact(contact, members)
      return uid && onMap.has(uid) ? uid : null
    },
    [app.isMember, onMap, members],
  )
}
