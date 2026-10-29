import { setTodayItem } from '../firebase/db'
import { useApp } from './useApp'

/** The contacts and links you put on the top of Today, and a toggle (saved for every device). */
export function useTodayItems() {
  const { uid, member } = useApp()
  const ids = member.todayItems ?? []
  return {
    ids,
    isOn: (id: string) => ids.includes(id),
    toggle: (id: string) => setTodayItem(uid, member.todayItems, id, !ids.includes(id)),
  }
}
