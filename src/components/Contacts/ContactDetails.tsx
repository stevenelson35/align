import { useState, type FormEvent } from 'react'
import { commentThread, deleteRemovedImages, deleteTask, updateTask } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { List, Task } from '../../types'
import { cleanTags, CONTACT_LABELS, mailUrl, mapUrl, tagsIn, telUrl, type ContactLabel, type Labeled } from '../../utils/contacts'
import { cleanLinks, cleanUrls, detailsOf, MAX_IMAGES, taskDetails } from '../../utils/details'
import { smsUrl } from '../../utils/text'
import { AutoTextarea } from '../UI/AutoTextarea'
import { LinksAndPictures } from '../UI/Details'
import { EntryExtras, EntryFact, EntryPanel } from '../UI/EntryExtras'
import { Icon } from '../UI/Icon'
import { TagPicker } from './ContactTags'

type Contact = NonNullable<Task['contact']>

/** "Apr 12, 1985" or "Apr 12" (no year). */
function birthdayText(b: string): string {
  const m = b.match(/^(\d{4}|-)-?(\d{2})-(\d{2})$/)
  if (!m) return b
  const date = new Date(Date.UTC(2000, Number(m[2]) - 1, Number(m[3])))
  const md = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return /^\d{4}$/.test(m[1]) ? `${md}, ${m[1]}` : md
}

/** A contact in the side panel: a view with tap-to-call / text / email / map, and Edit for the form. */
export function ContactDetails({ item, list }: { item: Task; list: List }) {
  const app = useApp()
  const [editing, setEditing] = useState(false)
  if (editing) return <ContactForm item={item} onDone={() => setEditing(false)} />
  const c = item.contact ?? {}
  const label = (l: ContactLabel) => l[0].toUpperCase() + l.slice(1)
  return (
    <EntryPanel
      kind="Contact"
      title={item.title}
      onEdit={app.canEdit(item) ? () => setEditing(true) : undefined}
      onClose={() => app.selectTask(null)}
      facts={
        <>
          {(c.jobTitle || c.org) && <EntryFact icon="person">{[c.jobTitle, c.org].filter(Boolean).join(', ')}</EntryFact>}
          {(c.phones ?? []).map((p, i) => (
            <EntryFact key={`p${i}`} icon="phone">
              <a href={telUrl(p.value)}>{p.value}</a> <span className="muted small">{label(p.label)}</span>{' '}
              <a className="small" href={smsUrl(p.value, '')} aria-label={`Text ${p.value}`}>
                <Icon name="message" /> Text
              </a>
            </EntryFact>
          ))}
          {(c.emails ?? []).map((e, i) => (
            <EntryFact key={`e${i}`} icon="mail">
              <a href={mailUrl(e.value)}>{e.value}</a> <span className="muted small">{label(e.label)}</span>
            </EntryFact>
          ))}
          {(c.addresses ?? []).map((a, i) => (
            <EntryFact key={`a${i}`} icon="map">
              <a href={mapUrl(a.value)} target="_blank" rel="noopener noreferrer" className="contact-address">
                {a.value}
              </a>{' '}
              <span className="muted small">{label(a.label)}</span>
            </EntryFact>
          ))}
          {c.birthday && <EntryFact icon="calendar">Birthday {birthdayText(c.birthday)}</EntryFact>}
          {c.tags?.length ? (
            <EntryFact icon="pin">
              <span className="tag-chips">
                {c.tags.map((t) => (
                  <span key={t} className="badge">
                    {t}
                  </span>
                ))}
              </span>
            </EntryFact>
          ) : null}
          <EntryFact icon="list">{list.name}</EntryFact>
        </>
      }
    >
      <EntryExtras
        details={{ ...detailsOf(item, false), note: item.notes }}
        alt={item.title}
        thread={commentThread.task(item.id)}
        text={{ title: item.title, when: '', link: `${window.location.origin}${window.location.pathname}#/task/${item.id}` }}
        startTextOpen={app.textingId === item.id}
      />
    </EntryPanel>
  )
}

/** Phones, emails or addresses: a label and a value per row, ✕ to remove, "+ Add" for another. */
function LabeledRows({ title, rows, onChange, placeholder, multiline = false, type = 'text' }: { title: string; rows: Labeled[]; onChange: (r: Labeled[]) => void; placeholder: string; multiline?: boolean; type?: string }) {
  const set = (i: number, patch: Partial<Labeled>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div className="labeled-rows">
      <span className="label">{title}</span>
      {rows.map((r, i) => (
        <div key={i} className="row labeled-row">
          <select value={r.label} onChange={(e) => set(i, { label: e.target.value as ContactLabel })} aria-label={`${title} ${i + 1} label`}>
            {CONTACT_LABELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          {multiline ? (
            <AutoTextarea rows={2} className="grow" value={r.value} onChange={(e) => set(i, { value: e.target.value })} placeholder={placeholder} aria-label={`${title} ${i + 1}`} />
          ) : (
            <input type={type} className="grow" value={r.value} onChange={(e) => set(i, { value: e.target.value })} placeholder={placeholder} aria-label={`${title} ${i + 1}`} />
          )}
          <button type="button" className="link small" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`Remove ${title.toLowerCase()} ${i + 1}`}>
            <Icon name="close" />
          </button>
        </div>
      ))}
      <button type="button" className="secondary small" onClick={() => onChange([...rows, { label: rows.length ? 'other' : 'mobile', value: '' }])}>
        + Add
      </button>
    </div>
  )
}

function ContactForm({ item, onDone }: { item: Task; onDone: () => void }) {
  const app = useApp()
  const c = item.contact ?? {}
  const [name, setName] = useState(item.title)
  const [org, setOrg] = useState(c.org ?? '')
  const [jobTitle, setJobTitle] = useState(c.jobTitle ?? '')
  const [birthday, setBirthday] = useState(c.birthday ?? '')
  const [phones, setPhones] = useState<Labeled[]>(c.phones ?? [{ label: 'mobile', value: '' }])
  const [emails, setEmails] = useState<Labeled[]>(c.emails ?? [])
  const [addresses, setAddresses] = useState<Labeled[]>(c.addresses ?? [])
  const [notes, setNotes] = useState(item.notes ?? '')
  const [tags, setTags] = useState<string[]>(c.tags ?? [])
  const { listItems } = useData()
  const [extras, setExtras] = useState(() => detailsOf(item, false))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    const links = cleanLinks(extras.links)
    const images = cleanUrls(extras.images, MAX_IMAGES, 'pictures')
    if (typeof links === 'string' || typeof images === 'string') return setError(typeof links === 'string' ? links : (images as string))
    const keep = (rows: Labeled[]) => rows.map((r) => ({ label: r.label, value: r.value.trim() })).filter((r) => r.value)
    const contact: Contact = {
      ...(keep(phones).length ? { phones: keep(phones) } : {}),
      ...(keep(emails).length ? { emails: keep(emails) } : {}),
      ...(keep(addresses).length ? { addresses: keep(addresses) } : {}),
      ...(org.trim() ? { org: org.trim() } : {}),
      ...(jobTitle.trim() ? { jobTitle: jobTitle.trim() } : {}),
      ...(birthday ? { birthday } : {}),
      ...(cleanTags(tags).length ? { tags: cleanTags(tags) } : {}),
    }
    setBusy(true)
    try {
      await updateTask(item.id, { title: name.trim() || item.title, notes: notes.trim() || undefined, contact: Object.keys(contact).length ? contact : undefined, ...taskDetails({ links, images }) })
      void deleteRemovedImages(detailsOf(item, false).images, images)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${item.title}?`)) return
    await deleteTask(item).catch((err) => setError(String(err)))
    app.selectTask(null)
  }

  return (
    <form className="task-details form" onSubmit={save}>
      <header className="row panel-header">
        <h3 className="grow">Edit contact</h3>
        <button type="submit" className="small" disabled={busy}>
          Save
        </button>
        <button type="button" className="secondary small" onClick={onDone}>
          Cancel
        </button>
      </header>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <div className="grid2">
        <label>
          Company
          <input value={org} onChange={(e) => setOrg(e.target.value)} />
        </label>
        <label>
          Job title
          <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
        </label>
      </div>
      <LabeledRows title="Phones" rows={phones} onChange={setPhones} placeholder="407 555 0100" type="tel" />
      <LabeledRows title="Emails" rows={emails} onChange={setEmails} placeholder="name@example.com" type="email" />
      <LabeledRows title="Addresses" rows={addresses} onChange={setAddresses} placeholder={'Street\nCity, State ZIP'} multiline />
      <label>
        Birthday
        <input type="date" value={/^\d{4}-/.test(birthday) ? birthday : ''} onChange={(e) => setBirthday(e.target.value)} />
      </label>
      <TagPicker value={tags} onChange={setTags} suggestions={tagsIn(listItems.filter((t) => t.contact?.tags?.length))} />
      <label>
        Notes
        <AutoTextarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <LinksAndPictures value={extras} onChange={(d) => setExtras({ ...extras, ...d })} onError={setError} />
      {error && <p className="error small">{error}</p>}
      <div className="row">
        <span className="grow" />
        <button type="button" className="danger small" onClick={remove}>
          Delete
        </button>
      </div>
    </form>
  )
}
