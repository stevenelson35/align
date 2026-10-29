import { setTodayItem, setTodayItems } from '../firebase/db'
import { useApp } from './useApp'

/** Your Shortcuts (contacts and links, in your order), a toggle and reordering (saved for every device). */
export function useTodayItems() {
  const { uid, member } = useApp()
  const ids = member.todayItems ?? []
  return {
    ids,
    isOn: (id: string) => ids.includes(id),
    toggle: (id: string) => setTodayItem(uid, member.todayItems, id, !ids.includes(id)),
    /** Swaps two of them (moving one up or down past the other). */
    swap: (a: string, b: string) => setTodayItems(uid, ids.map((x) => (x === a ? b : x === b ? a : x))),
  }
}
