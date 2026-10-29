import { setPinned } from '../firebase/db'
import { useApp } from './useApp'

/** Your pins (lists and contacts at the top of Today's sections), and a toggle that saves them for every device. */
export function usePinned() {
  const { uid, member } = useApp()
  const ids = member.pinned ?? []
  return {
    isPinned: (id: string) => ids.includes(id),
    toggle: (id: string) => setPinned(uid, member.pinned, id, !ids.includes(id)),
    order: (id: string) => ids.indexOf(id),
  }
}
