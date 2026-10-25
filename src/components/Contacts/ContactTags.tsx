import { useState } from 'react'
import type { List, Task } from '../../types'
import { asContact, cleanTags, contactsToCsv, contactsToVcf, MAX_TAGS, NO_TAG, STARTER_TAGS } from '../../utils/contacts'
import { download, fileNameFor } from '../../utils/transfer'
import { Icon } from '../UI/Icon'

/**
 * A contact's tags in the edit form: the chosen ones (✕ removes), the suggestions (tags in use plus a starter set)
 * as chips to tap, and a box for any new word.
 */
export function TagPicker({ value, onChange, suggestions }: { value: string[]; onChange: (tags: string[]) => void; suggestions: string[] }) {
  const [text, setText] = useState('')
  const chosen = new Set(value.map((t) => t.toLowerCase()))
  const offered = cleanTags([...suggestions, ...STARTER_TAGS]).filter((t) => !chosen.has(t.toLowerCase()))
  const add = (t: string) => {
    onChange(cleanTags([...value, t]))
    setText('')
  }
  return (
    <div className="tag-picker">
      <span className="label">Tags</span>
      <div className="tag-chips">
        {value.map((t) => (
          <button key={t} type="button" className="chip-toggle on" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove tag ${t}`} title="Remove">
            {t} <Icon name="close" />
          </button>
        ))}
        {offered.map((t) => (
          <button key={t} type="button" className="chip-toggle" onClick={() => add(t)} disabled={value.length >= MAX_TAGS} aria-label={`Add tag ${t}`}>
            + {t}
          </button>
        ))}
      </div>
      <div className="row">
        <input
          className="grow"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (text.trim()) add(text)
            }
          }}
          placeholder="New tag (Ballet, Nutcracker…)"
          aria-label="New tag"
          maxLength={40}
        />
        <button type="button" className="secondary small" onClick={() => add(text)} disabled={!text.trim() || value.length >= MAX_TAGS}>
          Add tag
        </button>
      </div>
    </div>
  )
}

/** A row of on/off chips with "All" first: nothing chosen means all. */
function ChipFilter({ label, options, chosen, onToggle, onAll }: { label: string; options: { value: string; label: string }[]; chosen: Set<string>; onToggle: (v: string) => void; onAll: () => void }) {
  return (
    <div className="chip-filter small" role="group" aria-label={label}>
      <span className="muted">{label}:</span>
      <label className={`chip-toggle${chosen.size ? '' : ' on'}`}>
        <input type="checkbox" checked={!chosen.size} onChange={onAll} />
        All
      </label>
      {options.map((o) => (
        <label key={o.value} className={`chip-toggle${chosen.has(o.value) ? ' on' : ''}`}>
          <input type="checkbox" checked={chosen.has(o.value)} onChange={() => onToggle(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  )
}

/**
 * Which contacts a search covers: the contact lists (when there are several) and the tags (any of the chosen ones;
 * "No tag" finds people not tagged yet). Both start at All.
 */
export function ContactFilters(props: {
  lists?: List[]
  chosenLists?: Set<string>
  onToggleList?: (id: string) => void
  onAllLists?: () => void
  tags: string[]
  chosenTags: Set<string>
  onToggleTag: (tag: string) => void
  onAllTags: () => void
}) {
  const { lists = [], chosenLists = new Set(), tags, chosenTags } = props
  return (
    <div className="contact-filters">
      {lists.length > 1 && props.onToggleList && props.onAllLists && (
        <ChipFilter label="Lists" options={lists.map((l) => ({ value: l.id, label: l.name }))} chosen={chosenLists} onToggle={props.onToggleList} onAll={props.onAllLists} />
      )}
      {tags.length > 0 && (
        <ChipFilter label="Tags" options={[...tags.map((t) => ({ value: t.toLowerCase(), label: t })), { value: NO_TAG, label: 'No tag' }]} chosen={chosenTags} onToggle={props.onToggleTag} onAll={props.onAllTags} />
      )}
    </div>
  )
}

/** "Export (n)": the people shown, as a vCard file (for a phone or contacts app) or CSV (spreadsheet, card labels). */
export function ExportContacts({ people, name }: { people: Task[]; name: string }) {
  const [open, setOpen] = useState(false)
  if (!people.length) return null
  const save = (kind: 'vcf' | 'csv') => {
    const all = people.map(asContact)
    if (kind === 'vcf') download(fileNameFor(name, 'vcf'), contactsToVcf(all), 'text/vcard')
    else download(fileNameFor(name, 'csv'), contactsToCsv(all), 'text/csv')
    setOpen(false)
  }
  return (
    <span className="export-contacts">
      <button type="button" className="link small" onClick={() => setOpen(!open)} aria-expanded={open} title="Save these people to a file">
        Export {people.length}
      </button>
      {open && (
        <>
          <button type="button" className="secondary small" onClick={() => save('vcf')} title="For a phone, Google Contacts or Outlook">
            vCard (.vcf)
          </button>
          <button type="button" className="secondary small" onClick={() => save('csv')} title="For a spreadsheet or mailing labels">
            Spreadsheet (.csv)
          </button>
        </>
      )}
    </span>
  )
}
