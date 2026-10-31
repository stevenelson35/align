// More than one person on a device (DESIGN.md §2): each person signed in here has their own Firebase session (a
// named app instance), so a shared phone can switch between them in one tap with no passwords; everything done
// after a switch counts as that person. Which one is open, and who's remembered, is kept in localStorage.

export interface Account {
  /** The session's slot ('main' is the device's first). */
  slot: string
  uid: string
  name: string
  color: string
}

const SLOT = 'align-slot'
const LIST = 'align-accounts'

/** The slot this page opened in. */
export function currentSlot(): string {
  try {
    return localStorage.getItem(SLOT) || 'main'
  } catch {
    return 'main'
  }
}

export function loadAccounts(): Account[] {
  try {
    const list = JSON.parse(localStorage.getItem(LIST) ?? '[]') as Account[]
    return Array.isArray(list) ? list.filter((a) => a && typeof a.slot === 'string' && typeof a.uid === 'string') : []
  } catch {
    return []
  }
}

const save = (list: Account[]) => localStorage.setItem(LIST, JSON.stringify(list))

/** Remembers who is signed in to this slot (and forgets an older slot of the same person). */
export function rememberAccount(a: Account) {
  const list = loadAccounts().filter((x) => x.slot !== a.slot && x.uid !== a.uid)
  const before = JSON.stringify(loadAccounts())
  const next = [...list, a].sort((x, y) => (x.slot === 'main' ? -1 : y.slot === 'main' ? 1 : x.name.localeCompare(y.name)))
  if (JSON.stringify(next) !== before) save(next)
}

/** Opens Align as someone else remembered on this device. */
export function switchTo(slot: string) {
  if (slot === 'main') localStorage.removeItem(SLOT)
  else localStorage.setItem(SLOT, slot)
  window.location.reload()
}

/** A new, empty slot: Align opens on the sign-in page for the next person. */
export function addPerson() {
  switchTo(`p${Date.now().toString(36)}`)
}

/** After signing out: forget this slot, and open the next person remembered here (if any) instead. */
export function forgetCurrent() {
  const slot = currentSlot()
  const rest = loadAccounts().filter((a) => a.slot !== slot)
  save(rest)
  if (rest.length && rest[0].slot !== 'main') localStorage.setItem(SLOT, rest[0].slot)
  else localStorage.removeItem(SLOT)
}
