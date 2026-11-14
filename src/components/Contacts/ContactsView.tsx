import { useState, type FormEvent, type ReactNode } from 'react'
import { addTaskNow } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { List, Task } from '../../types'
import type { EntrySize } from '../../utils/entries'
import { birthdayText, hasAnyTag, mailUrl, mapUrl, matches, NO_TAG, tagsIn, telUrl } from '../../utils/contacts'
import { useStoredSet } from '../../hooks/useStoredSet'
import { ContactFilters, ExportContacts } from './ContactTags'
import { smsUrl } from '../../utils/text'
import { ListHeader } from '../Tasks/ListHeader'
import { Icon } from '../UI/Icon'
import { Picture } from '../UI/Picture'
import { ItemIcon } from '../UI/ItemIcon'
import { EntryRow } from '../Entries/EntryRow'
import { EntrySizeSwitch } from '../Entries/EntrySizeSwitch'
import { useEntrySize } from '../../hooks/useEntrySize'
import { useFamilyOnMap } from '../../hooks/useFamilyOnMap'
import { EntryFact } from '../UI/EntryExtras'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')

/**
 * Contacts (DESIGN.md §5.10): everyone in the list, A–Z, with a search box and one-tap call / text / email for the
 * first number and address. Tap a person for everything else; Import / Export (vCard) is in the header.
 */
export function ContactsView({ list }: { list: List }) {
  const app = useApp()
  const onMap = useFamilyOnMap()
  const { listItems } = useData()
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const people = listItems.filter((t) => t.listId === list.id).sort((a, b) => a.title.localeCompare(b.title))
  const tags = tagsIn(people)
  const [chosen, toggleTag, allTags] = useStoredSet(`align-contacts-tags-${list.id}`)
  const tagFilter = new Set([...chosen].filter((t) => t === NO_TAG || tags.some((x) => x.toLowerCase() === t)))
  const filtering = !!query.trim() || tagFilter.size > 0
  const shown = filtering ? people.filter((p) => hasAnyTag(p, tagFilter) && matches(p, query)) : people
  const [size, setSize] = useEntrySize(list)

  function add(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    setName('')
    const { id } = addTaskNow(list, { title: n, priority: 2, status: 'todo', context: list.defaultContext, durationDays: 1, dependsOn: [] }, app.uid)
    app.selectTask(id) // open it to add numbers and addresses
  }

  return (
    <section className="contacts-view">
      <ListHeader list={list}>
        <EntrySizeSwitch value={size} onChange={setSize} />
      </ListHeader>
      <input type="search" className="contacts-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${people.length} contacts (name, company, number, tag…)`} aria-label="Search contacts" />
      <ContactFilters tags={tags} chosenTags={tagFilter} onToggleTag={toggleTag} onAllTags={allTags} />
      {filtering && shown.length > 0 && (
        <p className="muted small row">
          <span className="grow">
            {shown.length} of {people.length}
          </span>
          <ExportContacts people={shown} name={`${list.name} ${[...tagFilter].filter((t) => t !== NO_TAG).join(' ') || query.trim()}`} />
        </p>
      )}
      {app.canEdit(list) && (
        <form className="row add-task" onSubmit={add}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a person…" aria-label="New contact name" />
          <button type="submit" className="icon-button" aria-label="Add contact" title="Add contact" disabled={!name.trim()}>
            <Icon name="plus" />
          </button>
        </form>
      )}
      <ul className="entry-list contacts-list">
        {shown.map((p) => (
          <PersonRow key={p.id} person={p} size={size} mapUid={onMap(p)} />
        ))}
      </ul>
      {!people.length && <p className="muted small">No contacts yet. Add a person above, or Import a .vcf or CSV file from your phone, Google or Outlook.</p>}
      {people.length > 0 && !shown.length && <p className="muted small">Nobody matches{query.trim() ? ` “${query}”` : ' those tags'}.</p>}
    </section>
  )
}

/**
 * One person as an entry row (the contacts list): picture or initials, name; medium adds company and tags; opened in
 * place, their numbers, emails and addresses. Call / text / email stay on the row (so there's no second 💬).
 */
export function PersonRow({
  person: p,
  size,
  lead,
  aside,
  extra,
  className,
  mapUid,
  title,
  below,
  expanded,
}: {
  person: Task
  size: EntrySize
  /** Replaces the picture or initials (Today's icon). */
  lead?: ReactNode
  /** On the line, after the name. */
  aside?: ReactNode
  /** Shown first when opened (their location). */
  extra?: ReactNode
  className?: string
  /** They're a family member on the family map: a 🗺 button opens the map on them. */
  mapUid?: string | null
  /** Replaces the name button (Today's peek). */
  title?: ReactNode
  below?: ReactNode
  expanded?: boolean
}) {
  const app = useApp()
  const c = p.contact ?? {}
  const phone = c.phones?.[0]
  const email = c.emails?.[0]
  const sub = [[c.jobTitle, c.org].filter(Boolean).join(', '), (c.tags ?? []).join(', ')].filter(Boolean).join(' · ')
  return (
    <EntryRow
      entry={p}
      size={size}
      textButton={false}
      className={className}
      aside={aside}
      title={title}
      below={below}
      expanded={expanded}
      lead={
        lead ?? (
          <span className="avatar contact-avatar" aria-hidden="true">
            {p.images?.[0] ? <Picture src={p.images[0]} alt="" /> : initials(p.title)}
          </span>
        )
      }
      chips={sub ? <span>{sub}</span> : null}
      trail={
        <>
          {phone && (
            <>
              <a className="row-action" href={telUrl(phone.value)} title={`Call ${phone.value}`} aria-label={`Call ${p.title}`}>
                <Icon name="phone" />
              </a>
              <a className="row-action" href={smsUrl(phone.value, '')} title={`Text ${phone.value}`} aria-label={`Text ${p.title}`}>
                <Icon name="message" />
              </a>
            </>
          )}
          {email && (
            <a className="row-action" href={mailUrl(email.value)} title={`Email ${email.value}`} aria-label={`Email ${p.title}`}>
              <Icon name="mail" />
            </a>
          )}
          {mapUid && <MapButton uid={mapUid} name={p.title} onMap={(uid) => app.navigate({ view: 'map', person: uid })} />}
        </>
      }
      more={
        <>
        {extra}
        <ul className="entry-facts">
          {(c.phones ?? []).map((x, i) => (
            <EntryFact key={`p${i}`} icon="phone">
              <a href={telUrl(x.value)}>{x.value}</a> <span className="muted small">{x.label}</span>
            </EntryFact>
          ))}
          {(c.emails ?? []).map((x, i) => (
            <EntryFact key={`e${i}`} icon="mail">
              <a href={mailUrl(x.value)}>{x.value}</a> <span className="muted small">{x.label}</span>
            </EntryFact>
          ))}
          {(c.addresses ?? []).map((x, i) => (
            <EntryFact key={`a${i}`} icon="map">
              <a href={mapUrl(x.value)} target="_blank" rel="noopener noreferrer">
                {x.value}
              </a>{' '}
              <span className="muted small">{x.label}</span>
            </EntryFact>
          ))}
          {c.birthday && <EntryFact icon="calendar">Birthday {birthdayText(c.birthday)}</EntryFact>}
        </ul>
        </>
      }
    />
  )
}

/** One person: picture or initials, name and company (tap for the details panel), then call / text / email (Today's Contacts). */
export function ContactRow({ person: p, note, pin, block = false, mapUid }: { person: Task; note?: string; /** A ☆ pin button at the end. */ pin?: ReactNode; /** A plain block instead of a list item. */ block?: boolean; /** On the family map: 🗺 opens it on them. */ mapUid?: string | null }) {
  const app = useApp()
  const phone = p.contact?.phones?.[0]
  const email = p.contact?.emails?.[0]
  const Row = block ? 'div' : 'li'
  const sub = [[p.contact?.jobTitle, p.contact?.org].filter(Boolean).join(', '), note, (p.contact?.tags ?? []).join(', ')].filter(Boolean).join(' · ')
  return (
    <Row className={`contact-row${app.selectedTaskId === p.id ? ' selected' : ''}`}>
      <button type="button" className="contact-main" onClick={() => app.selectTask(p.id)}>
        <span className="avatar contact-avatar" aria-hidden="true">
          {p.images?.[0] ? <Picture src={p.images[0]} alt="" /> : initials(p.title)}
        </span>
        <span className="contact-text">
          <strong><ItemIcon value={p.customIcon} /> {p.title}</strong>
          {sub && <span className="muted small">{sub}</span>}
        </span>
      </button>
      {phone && (
        <>
          <a className="row-action" href={telUrl(phone.value)} title={`Call ${phone.value}`} aria-label={`Call ${p.title}`}>
            <Icon name="phone" />
          </a>
          <a className="row-action" href={smsUrl(phone.value, '')} title={`Text ${phone.value}`} aria-label={`Text ${p.title}`}>
            <Icon name="message" />
          </a>
        </>
      )}
      {email && (
        <a className="row-action" href={mailUrl(email.value)} title={`Email ${email.value}`} aria-label={`Email ${p.title}`}>
          <Icon name="mail" />
        </a>
      )}
      {mapUid && <MapButton uid={mapUid} name={p.title} onMap={(uid) => app.navigate({ view: 'map', person: uid })} />}
      {pin}
    </Row>
  )
}

/** 🗺 on a person who's a family member on the family map: opens the map centered on them. */
function MapButton({ uid, name, onMap }: { uid: string; name: string; onMap: (uid: string) => void }) {
  return (
    <button type="button" className="row-action" onClick={() => onMap(uid)} title={`Show ${name} on the family map`} aria-label={`Show ${name} on the family map`}>
      <Icon name="map" />
    </button>
  )
}
