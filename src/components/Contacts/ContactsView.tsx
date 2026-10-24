import { useState, type FormEvent } from 'react'
import { addTaskNow } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { List, Task } from '../../types'
import { mailUrl, matches, telUrl } from '../../utils/contacts'
import { smsUrl } from '../../utils/text'
import { ListHeader } from '../Tasks/ListHeader'
import { Icon } from '../UI/Icon'
import { Picture } from '../UI/Picture'

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
  const { listItems } = useData()
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const people = listItems.filter((t) => t.listId === list.id).sort((a, b) => a.title.localeCompare(b.title))
  const shown = query.trim() ? people.filter((p) => matches(p, query)) : people

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
      <ListHeader list={list} />
      <input type="search" className="contacts-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${people.length} contacts (name, company, number…)`} aria-label="Search contacts" />
      {app.canEdit(list) && (
        <form className="row add-task" onSubmit={add}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a person…" aria-label="New contact name" />
          <button type="submit" className="icon-button" aria-label="Add contact" title="Add contact" disabled={!name.trim()}>
            <Icon name="plus" />
          </button>
        </form>
      )}
      <ul className="contacts-list">
        {shown.map((p) => (
          <ContactRow key={p.id} person={p} />
        ))}
      </ul>
      {!people.length && <p className="muted small">No contacts yet. Add a person above, or Import a .vcf or CSV file from your phone, Google or Outlook.</p>}
      {people.length > 0 && !shown.length && <p className="muted small">Nobody matches “{query}”.</p>}
    </section>
  )
}

/** One person: picture or initials, name and company (tap for the details panel), then call / text / email. */
export function ContactRow({ person: p, note }: { person: Task; note?: string }) {
  const app = useApp()
  const phone = p.contact?.phones?.[0]
  const email = p.contact?.emails?.[0]
  const sub = [[p.contact?.jobTitle, p.contact?.org].filter(Boolean).join(', '), note].filter(Boolean).join(' · ')
  return (
    <li className={`contact-row${app.selectedTaskId === p.id ? ' selected' : ''}`}>
      <button type="button" className="contact-main" onClick={() => app.selectTask(p.id)}>
        <span className="avatar contact-avatar" aria-hidden="true">
          {p.images?.[0] ? <Picture src={p.images[0]} alt="" /> : initials(p.title)}
        </span>
        <span className="contact-text">
          <strong>{p.title}</strong>
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
    </li>
  )
}
