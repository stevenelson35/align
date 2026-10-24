import { useState } from 'react'
import { useApp, useData } from '../../hooks/useApp'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { SectionHeader } from '../UI/SectionHeader'
import { matches } from '../../utils/contacts'
import { ContactRow } from './ContactsView'

const MAX_SHOWN = 8

/**
 * Contacts on the Today page: a quick look-up. Pick a contact list (or all of them), type a name, company or number,
 * and the matches show below with call / text / email; tap a person for everything. "All contacts" opens the list's
 * own page. Starts folded; open or closed is remembered on this device.
 */
export function ContactsStrip() {
  const { navigate, uid } = useApp()
  const { lists, listItems } = useData()
  const [open, setOpen] = useStoredFlag('align-today-contacts', false)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState('all')
  const contactLists = lists.filter((l) => l.kind === 'contacts' && (l.visibility !== 'private' || l.ownerId === uid)).sort((a, b) => a.name.localeCompare(b.name))
  if (!contactLists.length) return null
  const listId = contactLists.some((l) => l.id === picked) ? picked : contactLists.length === 1 ? contactLists[0].id : 'all'
  const inLists = new Set(listId === 'all' ? contactLists.map((l) => l.id) : [listId])
  const people = listItems.filter((t) => inLists.has(t.listId))
  const found = query.trim() ? people.filter((p) => matches(p, query)).sort((a, b) => a.title.localeCompare(b.title)) : []
  const listName = (id: string) => (contactLists.length > 1 ? contactLists.find((l) => l.id === id)?.name : undefined)
  const goTo = contactLists.find((l) => l.id === listId) ?? contactLists[0]
  const openList = () => navigate({ view: 'list', listId: goTo.id, timeline: false })

  return (
    <div className="day-section contacts-strip">
      <SectionHeader icon="person" title="Contacts" count={people.length} onTitleClick={() => setOpen(!open)} expanded={open} help="contacts">
        <button type="button" className="link small" onClick={openList} title={`Open ${goTo.name}`}>
          All contacts
        </button>
        <button type="button" className="link small" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'}
        </button>
      </SectionHeader>
      {open && (
        <>
          <div className="row contacts-strip-search">
            {contactLists.length > 1 && (
              <select value={listId} onChange={(e) => setPicked(e.target.value)} aria-label="Which contacts">
                <option value="all">All contacts</option>
                {contactLists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            )}
            <input type="search" className="grow" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a name, company or number…" aria-label="Find a contact" />
          </div>
          {found.length > 0 && (
            <ul className="contacts-list">
              {found.slice(0, MAX_SHOWN).map((p) => (
                <ContactRow key={p.id} person={p} note={listId === 'all' ? listName(p.listId) : undefined} />
              ))}
            </ul>
          )}
          {found.length > MAX_SHOWN && (
            <p className="muted small">
              {found.length - MAX_SHOWN} more: type more of the name, or open{' '}
              <button type="button" className="link small" onClick={openList}>
                {goTo.name}
              </button>
              .
            </p>
          )}
          {query.trim() && !found.length && <p className="muted small">Nobody matches “{query}”.</p>}
        </>
      )}
    </div>
  )
}
