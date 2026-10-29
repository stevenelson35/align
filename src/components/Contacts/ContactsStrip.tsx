import { useApp, useData } from '../../hooks/useApp'
import { usePinned } from '../../hooks/usePinned'
import { useStoredSet } from '../../hooks/useStoredSet'
import type { Task } from '../../types'
import { hasAnyTag, matches, NO_TAG, tagsIn } from '../../utils/contacts'
import { CollectionSection, PinButton } from '../UI/CollectionSection'
import { ContactRow } from './ContactsView'
import { ContactFilters, ExportContacts } from './ContactTags'

/**
 * Contacts on the Today page, in the shared shape: your pinned people (with call / text / email), then search with
 * the contact-list and tag filters (All by default, remembered on this device), then Show all to scroll through
 * everyone here. A tag filter alone lists everyone with it, and Export saves them. "All contacts" opens the list page
 * (import, export, editing).
 */
export function ContactsStrip() {
  const { navigate, uid } = useApp()
  const { lists, listItems } = useData()
  const pins = usePinned()
  const [chosenLists, toggleList, allLists] = useStoredSet('align-contacts-lists')
  const [chosenTags, toggleTag, allTags] = useStoredSet('align-contacts-tags')
  const contactLists = lists.filter((l) => l.kind === 'contacts' && (l.visibility !== 'private' || l.ownerId === uid)).sort((a, b) => a.name.localeCompare(b.name))
  if (!contactLists.length) return null
  const listIds = contactLists.map((l) => l.id).filter((id) => !chosenLists.size || chosenLists.has(id))
  const inLists = new Set(listIds.length ? listIds : contactLists.map((l) => l.id)) // a remembered list that's gone counts as All
  const everyone = listItems.filter((t) => contactLists.some((l) => l.id === t.listId))
  const people = everyone.filter((t) => inLists.has(t.listId))
  const tags = tagsIn(people)
  // Remembered tags that no one has any more don't filter.
  const tagFilter = new Set([...chosenTags].filter((t) => t === NO_TAG || tags.some((x) => x.toLowerCase() === t)))
  const shown = people.filter((p) => hasAnyTag(p, tagFilter)).sort((a, b) => a.title.localeCompare(b.title))
  const pinned = everyone.filter((p) => pins.isPinned(p.id)).sort((a, b) => pins.order(a.id) - pins.order(b.id))
  const listName = (id: string) => (contactLists.length > 1 ? contactLists.find((l) => l.id === id)?.name : undefined)
  const goTo = contactLists.find((l) => inLists.has(l.id)) ?? contactLists[0]
  const filtering = tagFilter.size > 0 || chosenLists.size > 0

  return (
    <CollectionSection<Task>
      id="contacts"
      title="Contacts"
      icon="person"
      help="contacts"
      count={people.length}
      actions={
        <button type="button" className="link small" onClick={() => navigate({ view: 'list', listId: goTo.id, timeline: false })} title={`Open ${goTo.name} (import, export, edit)`}>
          All contacts
        </button>
      }
      items={shown}
      pinned={pinned}
      itemKey={(p) => p.id}
      matches={(p, q) => matches(p, q)}
      render={(p) => (
        <ContactRow block person={p} note={listName(p.listId)} pin={<PinButton pinned={pins.isPinned(p.id)} onToggle={() => void pins.toggle(p.id)} label={p.title} />} />
      )}
      searchHint="Find a name, company, number or tag…"
      filters={
        <>
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
          {filtering && shown.length > 0 && (
            <p className="muted small row">
              <span className="grow">
                {shown.length} {shown.length === 1 ? 'person' : 'people'} in this filter
              </span>
              <ExportContacts people={shown} name={[...tagFilter].filter((t) => t !== NO_TAG).join(' ') || 'contacts'} />
            </p>
          )}
        </>
      }
      empty={<p className="muted small">No contacts{filtering ? ' in this filter' : ' yet'}.</p>}
    />
  )
}
