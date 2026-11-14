import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useApp } from '../../hooks/useApp'
import { useTodayTiles } from '../../hooks/useTodayTiles'
import type { Task } from '../../types'
import { detailsOf } from '../../utils/details'
import { tile } from '../../utils/tiles'
import type { EntrySize } from '../../utils/entries'
import { DetailsMarks, DetailsView } from '../UI/Details'
import { Icon, type IconName } from '../UI/Icon'
import { ItemIcon } from '../UI/ItemIcon'
import { RelatedNotes } from '../UI/RelatedNotes'

/** A row's checkbox (checklist items, tasks). */
export interface RowCheck {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (checked: boolean) => void
}

/**
 * One entry as a row, the same for every kind of list (DESIGN.md §13, refactor phase 2):
 * - **simple:** checkbox (where the list has one), icon, title, and a mark if it has text;
 * - **medium:** plus marks for links and pictures and the kind's own facts (`chips`: a task's dates, a link's
 *   category, a title's stars);
 * - **detail:** everything in place: its text, links, pictures and related notes.
 * Tapping the title opens it in place (the detail, with Edit / Comment / Send…); 💬 texts someone about it in one
 * tap; "⋯" or pressing and holding the row opens the same actions as a menu. `title` replaces the plain title (a link's name opens the site), `trail` adds
 * quick buttons (call, open), `lead` replaces the checkbox (a flashcard's ✓ / ✗).
 */
export function EntryRow({
  entry,
  size,
  check,
  lead,
  title,
  chips,
  trail,
  kindIcon,
  className = '',
  canPin = true,
  as: Tag = 'li',
  textButton = true,
  more,
  aside,
}: {
  entry: Task
  size: EntrySize
  check?: RowCheck
  lead?: ReactNode
  title?: ReactNode
  chips?: ReactNode
  trail?: ReactNode
  /** The kind's icon, for rows mixed from several kinds (search, Today). */
  kindIcon?: IconName
  className?: string
  /** Offer Pin to Today (members). */
  canPin?: boolean
  /** 'div' where the rows aren't in a list (Today's To Do, the Tasks page). */
  as?: 'li' | 'div'
  /** The one-tap 💬 "text someone about this" (off where the row has its own text button, e.g. a person). */
  textButton?: boolean
  /** The kind's own details, shown first when opened in place (a person's numbers and addresses). */
  more?: ReactNode
  /** A short fact on the same line, after the title (a family member's location). */
  aside?: ReactNode
}) {
  const app = useApp()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const detail = size === 'detail' || open
  const details = detailsOf(entry, false) // its own address (a link, a "Read:" task) shows on its own
  const hasText = !!entry.notes?.trim()
  const press = useLongPress(() => setMenu(true))

  return (
    <Tag
      className={`entry-row size-${size}${detail ? ' open' : ''}${app.selectedTaskId === entry.id ? ' selected' : ''} ${className}`}
      {...press}
      onContextMenu={(e) => {
        // A long press on a phone (or a right-click) opens the actions instead of the browser's menu.
        e.preventDefault()
        setMenu(true)
      }}
    >
      <div className="entry-line">
        {lead ??
          (check && (
            <input
              type="checkbox"
              className="entry-check"
              aria-label={check.label}
              checked={check.checked}
              disabled={check.disabled}
              onChange={(e) => check.onChange(e.target.checked)}
            />
          ))}
        <div className="entry-main">
          {title ?? (
            <button type="button" className="entry-title" onClick={() => setOpen(!open)} aria-expanded={detail}>
              {kindIcon && <Icon name={kindIcon} />}
              <ItemIcon value={entry.customIcon} />
              <span className="entry-title-text">{entry.title}</span>
              {hasText && !detail && <Icon name="note" label="Has text" />}
            </button>
          )}
          {aside && <span className="entry-aside small">{aside}</span>}
          {size !== 'simple' && (
            <div className="entry-marks small">
              <DetailsMarks links={details.links} images={details.images} />
              {chips}
            </div>
          )}
        </div>
        {trail}
        {textButton && (
          <button type="button" className="row-action" onClick={() => app.textAbout(entry.id)} aria-label={`Send ${entry.title} to someone`} title="Send this to someone (Align or text)">
            <Icon name="message" />
          </button>
        )}
        <button type="button" className="row-action entry-more" onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu} aria-label={`Actions for ${entry.title}`} title="More">
          <Icon name="more" />
        </button>
      </div>
      {detail && <EntryDetail entry={entry} canPin={canPin} actions={open} more={more} />}
      {menu && <EntryMenu entry={entry} canPin={canPin} onClose={() => setMenu(false)} />}
    </Tag>
  )
}

/** The entry in place: its text, links, pictures and related notes, and (opened by a tap) the actions as buttons. */
function EntryDetail({ entry, canPin, actions, more }: { entry: Task; canPin: boolean; actions: boolean; more?: ReactNode }) {
  const details = detailsOf(entry, false) // its own address (a link, a "Read:" task) shows on its own
  return (
    <div className="entry-detail">
      {more}
      {entry.notes?.trim() && <p className="entry-text">{entry.notes}</p>}
      <DetailsView links={details.links} images={details.images} alt={entry.title} />
      <RelatedNotes noteIds={entry.noteIds} />
      {actions && (
        <div className="entry-actions row wrap">
          {actionsFor(canPin).map((a) => (
            <ActionButton key={a} action={a} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}

/** The same actions as a menu (⋯, or press and hold). */
function EntryMenu({ entry, canPin, onClose }: { entry: Task; canPin: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const away = (e: Event) => !ref.current?.contains(e.target as Node) && onClose()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    // Next tick, so the tap that opened it doesn't close it.
    const t = setTimeout(() => document.addEventListener('pointerdown', away), 0)
    document.addEventListener('keydown', esc)
    ref.current?.querySelector('button')?.focus()
    return () => {
      clearTimeout(t)
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [onClose])
  return (
    <div className="entry-menu" role="menu" ref={ref} onClick={onClose}>
      {actionsFor(canPin).map((a) => (
        <ActionButton key={a} action={a} entry={entry} menu />
      ))}
    </div>
  )
}

type EntryAction = 'open' | 'edit' | 'move' | 'comment' | 'send' | 'pin'

/** Open, Edit, Move, Comment, Send, Pin: what you can do with any entry (Edit and Move only if you may edit it). */
const actionsFor = (canPin: boolean): EntryAction[] => ['open', 'edit', 'move', 'comment', 'send', ...(canPin ? (['pin'] as const) : [])]

function ActionButton({ action, entry, menu }: { action: EntryAction; entry: Task; menu?: boolean }) {
  const app = useApp()
  const today = useTodayTiles()
  const editable = app.canEdit(entry)
  if ((action === 'edit' || action === 'move') && !editable) return null
  if (action === 'pin' && !app.isMember) return null
  const pinned = today.has(tile('entry', entry.id))
  const spec: Record<typeof action, { icon: IconName; text: string; run: () => void }> = {
    open: { icon: 'external', text: 'Open', run: () => app.openEntry(entry.id, 'view') },
    edit: { icon: 'edit', text: 'Edit', run: () => app.openEntry(entry.id, 'edit') },
    move: { icon: 'list', text: 'Move to another list', run: () => app.openEntry(entry.id, 'edit') },
    comment: { icon: 'message', text: 'Comment', run: () => app.openEntry(entry.id, 'comment') },
    send: { icon: 'send', text: 'Send…', run: () => app.textAbout(entry.id) },
    pin: { icon: 'pin', text: pinned ? 'Unpin from Today' : 'Pin to Today', run: () => void today.toggle(tile('entry', entry.id)).catch(() => undefined) },
  }
  const s = spec[action]
  return (
    <button type="button" className={menu ? 'entry-menu-item' : 'secondary small'} role={menu ? 'menuitem' : undefined} onClick={s.run}>
      <Icon name={s.icon} /> {s.text}
    </button>
  )
}

/** Press and hold (half a second, without moving): a phone's way to the actions. */
function useLongPress(onLong: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const start = useRef<{ x: number; y: number } | null>(null)
  const cancel = () => {
    clearTimeout(timer.current)
    start.current = null
  }
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' || (e.target as HTMLElement).closest('input, a, .entry-menu, .entry-detail')) return
      start.current = { x: e.clientX, y: e.clientY }
      timer.current = setTimeout(() => {
        start.current = null
        onLong()
      }, 500)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
  }
}
