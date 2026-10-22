import { useState, type ReactNode } from 'react'
import { useApp } from '../../hooks/useApp'
import type { Comment } from '../../types'
import type { Details } from '../../utils/details'
import { TextForm } from '../Tasks/TextAbout'
import { Comments } from './Comments'
import { DetailsView } from './Details'
import { Icon, type IconName } from './Icon'
import { HelpTip } from './HelpTip'

/** What a text about an entry says: its title, when (if anything), and a link that opens it. */
export interface TextSubject {
  title: string
  when: string
  link: string
}

/**
 * The block every entry shows below its own fields, the same everywhere (tasks, checklist items, notes, links,
 * voting items, goals): the note, links (names; addresses on request), pictures, comments, and Text about this.
 * "Text" on a comment opens the text form with that comment as the message.
 */
export function EntryExtras({
  details,
  alt,
  thread,
  text,
  startTextOpen = false,
}: {
  details: Partial<Details>
  alt: string
  /** The entry's comment thread (commentThread in db.ts). */
  thread: string
  text: TextSubject
  startTextOpen?: boolean
}) {
  const { isMember } = useApp()
  const [seed, setSeed] = useState<{ key: number; message: string } | null>(startTextOpen ? { key: 0, message: '' } : null)
  const textComment = (c: Comment) => {
    setSeed({ key: Date.now(), message: c.text })
    // The form sits just below the comments; bring it into view on a phone.
    setTimeout(() => document.querySelector('.entry-extras .text-about textarea')?.scrollIntoView({ block: 'center' }), 50)
  }
  return (
    <div className="entry-extras">
      <DetailsView note={details.note} links={details.links} images={details.images} alt={alt} />
      <div className="entry-section">
        <h4>
          <Icon name="message" /> Comments
          <HelpTip topic="details" label="comments, links and pictures" />
        </h4>
        <Comments thread={thread} onText={textComment} />
      </div>
      {isMember && (
        <TextForm key={seed?.key ?? 'closed'} subject={text} startOpen={seed !== null} initialMessage={seed?.message ?? ''} label="Text about this" />
      )}
    </div>
  )
}

/** One fact about an entry in its view: an icon and a short line ("Due Fri, Oct 24", "Family Inbox · Everyone"). */
export function EntryFact({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <li className="entry-fact">
      <Icon name={icon} /> <span>{children}</span>
    </li>
  )
}

/**
 * The side panel's view of an entry (before Edit): what it is, Edit and ✕ at the top, the title, its facts, any
 * extra content, then the common EntryExtras block.
 */
export function EntryPanel({
  kind,
  title,
  onEdit,
  onClose,
  facts,
  children,
}: {
  kind: string
  title: string
  onEdit?: () => void
  onClose: () => void
  facts?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="task-details entry-panel">
      <header className="row panel-header">
        <span className="grow muted small entry-kind">{kind}</span>
        {onEdit && (
          <button type="button" className="small" onClick={onEdit}>
            <Icon name="edit" /> Edit
          </button>
        )}
        <button type="button" className="link" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <h2 className="entry-title">{title}</h2>
      {facts && <ul className="entry-facts">{facts}</ul>}
      {children}
    </div>
  )
}
