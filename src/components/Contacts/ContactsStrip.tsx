import { useState } from 'react'
import { useApp, useData } from '../../hooks/useApp'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { useStoredSet } from '../../hooks/useStoredSet'
import { SectionHeader } from '../UI/SectionHeader'
import { hasAnyTag, matches, NO_TAG, tagsIn } from '../../utils/contacts'
import { ContactRow } from './ContactsView'
import { ContactFilters, ExportContacts } from './ContactTags'

const MAX_SHOWN = 8

/**
 * Contacts on the Today page: a quick look-up. Choose which contact lists and tags to search (All by default; both
 * remembered on this device), type a name, company or number, and the matches show below with call / text / email;
 * tap a person for everything. Choosing a tag alone lists everyone with it ("Christmas List"), and Export saves the
 * matches as a vCard or CSV file. "All contacts" opens the list's own page. Starts folded.
 */
export function ContactsStrip() {
  const { navigate, uid } = useApp()
  const { lists, listItems } = useData()
  const [open, setOpen] = useStoredFlag('align-today-contacts', false)
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [chosenLists, toggleList, allLists] = useStoredSet('align-contacts-lists')
  const [chosenTags, toggleTag, allTags] = useStoredSet('align-contacts-tags')
  const contactLists = lists.filter((l) => l.kind === 'contacts' && (l.visibility !== 'private' || l.ownerId === uid)).sort((a, b) => a.name.localeCompare(b.name))
  if (!contactLists.length) return null
  const listIds = contactLists.map((l) => l.id).filter((id) => !chosenLists.size || chosenLists.has(id))
  const inLists = new Set(listIds.length ? listIds : contactLists.map((l) => l.id)) // a remembered list that's gone counts as All
  const people = listItems.filter((t) => inLists.has(t.listId))
  const tags = tagsIn(people)
  // Remembered tags that no one has any more don't filter.
  const tagFilter = new Set([...chosenTags].filter((t) => t === NO_TAG || tags.some((x) => x.toLowerCase() === t)))
  const searching = !!query.trim() || tagFilter.size > 0
  const found = searching ? people.filter((p) => hasAnyTag(p, tagFilter) && matches(p, query)).sort((a, b) => a.title.localeCompare(b.title)) : []
  const listName = (id: string) => (inLists.size > 1 ? contactLists.find((l) => l.id === id)?.name : undefined)
  const goTo = contactLists.find((l) => inLists.has(l.id)) ?? contactLists[0]
  const openList = () => navigate({ view: 'list', listId: goTo.id, timeline: false })
  const exportName = [...tagFilter].filter((t) => t !== NO_TAG).join(' ') || query.trim() || 'contacts'

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
          <input type="search" className="contacts-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a name, company, number or tag…" aria-label="Find a contact" />
          <ContactFilters
            lists={contactLists}
            chosenLists={chosenLists}
            onToggleList={toggleList}
            onAllLists={allLists}
            tags={tags}
            chosenTags={tagFilter}
            onToggleTag={toggleTag}
            onAllTags={allTags}
          />
          {found.length > 0 && (
            <>
              <p className="muted small row">
                <span className="grow">
                  {found.length} {found.length === 1 ? 'match' : 'matches'}
                </span>
                <ExportContacts people={found} name={exportName} />
              </p>
              <ul className="contacts-list">
                {found.slice(0, showAll ? undefined : MAX_SHOWN).map((p) => (
                  <ContactRow key={p.id} person={p} note={listName(p.listId)} />
                ))}
              </ul>
            </>
          )}
          {found.length > MAX_SHOWN && (
            <button type="button" className="link small" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show fewer' : `Show all ${found.length}`}
            </button>
          )}
          {searching && !found.length && <p className="muted small">Nobody matches{query.trim() ? ` “${query}”` : ''}.</p>}
        </>
      )}
    </div>
  )
}
