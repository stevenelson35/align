import { setPinned } from '../firebase/db'
import { useApp } from './useApp'

/** Your pins (lists, contacts and voting boards on Today), saved for every device. */
export function usePinned() {
  const { uid, member } = useApp()
  const ids = member.pinned ?? []
  return {
    isPinned: (id: string) => ids.includes(id),
    toggle: (id: string) => setPinned(uid, member.pinned, id, !ids.includes(id)),
    order: (id: string) => ids.indexOf(id),
  }
}
