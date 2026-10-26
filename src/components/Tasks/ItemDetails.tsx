import { useState, type FormEvent } from 'react'
import { addReadingTask, commentThread, deleteRemovedImages, deleteTask, ratePick, readingListFor, setPinnedLink, setWatched, updateTask } from '../../firebase/db'
import { averageRating, pickKind } from '../../utils/picks'
import { formatDay, today } from '../../engine/dates'
import { useApp, useData } from '../../hooks/useApp'
import type { List, Task } from '../../types'
import { cleanCategory, defaultName, safeUrl } from '../../utils/links'
import { privacyText, targetName } from '../../utils/tasks'
import { Icon } from '../UI/Icon'
import { parentsOf } from '../../utils/audience'
import { AUDIENCE_ICON, audienceLabel, audienceOf } from '../../utils/audience'
import { cleanLinks, cleanUrls, detailsOf, MAX_IMAGES, taskDetails } from '../../utils/details'
import { DetailsView, LinksAndPictures } from '../UI/Details'
import { NotePicker } from '../UI/RelatedNotes'
import { EntryExtras, EntryFact, EntryPanel } from '../UI/EntryExtras'
import { shareLink } from '../../utils/text'
import { StarRating } from '../Picks/StarRating'
import { AutoTextarea } from '../UI/AutoTextarea'
import { ContactDetails } from '../Contacts/ContactDetails'
import { GiftClaimPanel } from '../Gifts/GiftDetails'
import { cleanGift, giftSummary, isRecipient, ownGiftIdea, recipientLabel } from '../../utils/gifts'

/**
 * Side panel for a checklist item, a note or a link. It opens as a view (the item, its note, links, pictures,
 * comments and Text about this: the common EntryExtras block); Edit switches to the form.
 */
export function ItemDetails({ item, list }: { item: Task; list: List }) {
  const app = useApp()
  const { lists } = useData()
  const [editing, setEditing] = useState(false)
  if (list.kind === 'contacts') return <ContactDetails item={item} list={list} />
  if (editing) return <ItemEditForm item={item} list={list} onDone={() => setEditing(false)} />
  const isNote = list.kind === 'notes'
  const isLink = list.kind === 'links'
  const isPick = list.kind === 'picks'
  const isGift = list.kind === 'gifts'
  const noun = isNote ? 'note' : isLink ? 'link' : isPick ? 'title' : isGift ? 'gift idea' : 'item'
  const forName = isGift ? recipientLabel(list, app.household) : ''
  const home = lists.find((l) => l.id === item.listId) ?? list
  const href = isLink ? safeUrl(item.url) : null
  return (
    <EntryPanel
      kind={isNote ? 'Note' : isLink ? 'Link' : isPick ? pickKind(list.pickKind).label : list.kind === 'cards' ? 'Flashcard' : isGift ? (list.giftSecret ? 'Secret gift idea' : 'Gift idea') : 'Checklist item'}
      title={item.title}
      onEdit={app.canEdit(item) || ownGiftIdea(item, list, app.member.role, app.uid) ? () => setEditing(true) : undefined}
      onClose={() => app.selectTask(null)}
      facts={
        <>
          {href && (
            <EntryFact icon="external">
              <a href={href} target="_blank" rel="noopener noreferrer">
                Open {defaultName(href)}
              </a>
              {item.category && <span className="muted"> · {item.category}</span>}
            </EntryFact>
          )}
          {isLink && href && app.isMember && (
            <EntryFact icon="pin">
              {app.member.pinnedLinks?.includes(item.id) ? 'Pinned to your menu (only you see it) · ' : ''}
              <button type="button" className="link small inline-link" onClick={() => setPinnedLink(app.uid, app.member.pinnedLinks, item.id, !app.member.pinnedLinks?.includes(item.id))}>
                {app.member.pinnedLinks?.includes(item.id) ? 'Unpin' : 'Pin to my menu'}
              </button>
            </EntryFact>
          )}
          {isGift && (
            <EntryFact icon="gift">
              For {forName}
              {giftSummary(item) && ` · ${giftSummary(item)}`}
              {list.giftSecret && ` · hidden from ${forName}`}
            </EntryFact>
          )}
          {list.kind === 'checklist' && <EntryFact icon={item.status === 'done' ? 'check' : 'todo'}>{item.status === 'done' ? 'Checked off' : 'Not checked off yet'}</EntryFact>}
          <EntryFact icon={AUDIENCE_ICON[audienceOf(home)]}>
            {home.name} · {privacyText(home, noun, app.household, app.uid)}
          </EntryFact>
        </>
      }
    >
      {isLink && <ReadingListButton item={item} />}
      {isPick && <PickRatings item={item} list={list} />}
      {isGift && <GiftClaimPanel item={item} list={list} />}
      <EntryExtras
        details={{ ...detailsOf(item, false), note: item.notes }}
        alt={item.title}
        thread={commentThread.task(item.id)}
        text={{ title: item.title, when: '', link: shareLink(item) }}
        startTextOpen={app.textingId === item.id}
        noteIds={item.noteIds}
        commentsNote={isGift && list.recipientId && !list.giftSecret && !isRecipient(list, app.uid) ? `${forName} can read these comments: keep surprises in your claim note above.` : undefined}
      />
    </EntryPanel>
  )
}

/** A pick-list title: your stars, everyone's ratings, and the days it was watched (with "Watched today"). */
function PickRatings({ item, list }: { item: Task; list: List }) {
  const app = useApp()
  const [error, setError] = useState<string | null>(null)
  const kind = pickKind(list.pickKind)
  const now = today()
  const fail = (err: unknown) => setError(err instanceof Error ? err.message : String(err))
  const ratings = Object.entries(item.ratings ?? {})
  const days = [...(item.watched ?? [])].sort().reverse()
  return (
    <div className="pick-ratings">
      {app.isMember && (
        <div className="row">
          <span className="muted small">Your rating</span>
          <StarRating value={item.ratings?.[app.uid]} onChange={(stars) => ratePick(item.id, app.uid, stars).catch(fail)} label={`Your rating for ${item.title}`} />
        </div>
      )}
      <p className="small muted">
        {ratings.length
          ? `★ ${averageRating(item)} from ${ratings.map(([uid, n]) => `${uid === app.uid ? 'you' : targetName(uid, app.household)} (${n})`).join(', ')}`
          : 'Nobody has rated it yet.'}
      </p>
      <p className="small muted">
        {days.length ? `${kind.did} ${days.slice(0, 5).map((d) => formatDay(d)).join(', ')}${days.length > 5 ? '…' : ''}` : `Not ${kind.did.toLowerCase()} yet.`}{' '}
        {app.isMember && (
          <button type="button" className="link small" onClick={() => setWatched(item.id, now, !days.includes(now)).catch(fail)}>
            {days.includes(now) ? `Undo ${kind.did.toLowerCase()} today` : `✓ ${kind.did} today`}
          </button>
        )}
      </p>
      {error && <p className="error small">{error}</p>}
    </div>
  )
}

/** A link's place on the reading list: open its "Read:" task, or add one. */
function ReadingListButton({ item }: { item: Task }) {
  const app = useApp()
  const { lists, tasks } = useData()
  const [error, setError] = useState<string | null>(null)
  const reading = tasks.find((t) => t.linkId === item.id)
  if (!item.url) return null
  return (
    <div className="row">
      {reading ? (
        <button type="button" className="link small" onClick={() => app.navigate({ view: 'task', taskId: reading.id })}>
          {reading.status === 'done' ? '✓ Read (open its task)' : <><Icon name="book" /> On the reading list (open its task)</>}
        </button>
      ) : (
        app.canEdit(item) && (
          <button
            type="button"
            className="secondary small"
            onClick={() =>
              readingListFor(app.uid, app.member.defaultVisibility, lists.filter((l) => app.canEdit(l)), parentsOf(app.household))
                .then((target) => addReadingTask(target, { id: item.id, title: item.title, url: item.url }, app.uid).written)
                .catch((err) => setError(err instanceof Error ? err.message : String(err)))
            }
          >
            <Icon name="book" /> Add to reading list
          </button>
        )
      )}
      {error && <p className="error small">{error}</p>}
    </div>
  )
}

/** The edit form: title, address and category (links), note, links and pictures, move, delete. */
function ItemEditForm({ item, list, onDone }: { item: Task; list: List; onDone: () => void }) {
  const app = useApp()
  const { lists } = useData()
  const editable = app.canEdit(item) || ownGiftIdea(item, list, app.member.role, app.uid)
  const isNote = list.kind === 'notes'
  const isLink = list.kind === 'links'
  const noun = isNote ? 'note' : isLink ? 'link' : 'item'
  const [title, setTitle] = useState(item.title)
  const [url, setUrl] = useState(item.url ?? '')
  const [category, setCategory] = useState(item.category ?? '')
  const [text, setText] = useState(item.notes ?? '')
  const [extras, setExtras] = useState(() => detailsOf(item, false))
  const [noteIds, setNoteIds] = useState<string[]>(item.noteIds ?? [])
  const isGift = list.kind === 'gifts'
  const [gift, setGift] = useState({ qty: String(item.gift?.qty ?? 1), color: item.gift?.color ?? '', size: item.gift?.size ?? '' })
  const wasPinned = !!app.member.pinnedLinks?.includes(item.id)
  const [pinned, setPinned] = useState(wasPinned)
  const [listId, setListId] = useState(item.listId)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Only to lists of the same kind (a note doesn't become a shopping item) that you can edit.
  const moveChoices = lists.filter((l) => l.kind === list.kind && (l.id === item.listId || app.canEdit(l)))

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const moveTo = listId !== item.listId ? lists.find((l) => l.id === listId) : undefined
      const link = isLink ? safeUrl(url) : null
      if (isLink && !link) throw new Error('That doesn’t look like a web address (http, https, mailto or tel).')
      const links = cleanLinks(extras.links)
      const images = cleanUrls(extras.images, MAX_IMAGES, 'pictures')
      if (typeof links === 'string') throw new Error(links)
      if (typeof images === 'string') throw new Error(images)
      await updateTask(
        item.id,
        {
          title: title.trim() || item.title,
          notes: text.trim() ? text : undefined,
          ...taskDetails({ links, images }),
          noteIds: noteIds.filter((id) => id !== item.id).length ? noteIds.filter((id) => id !== item.id) : undefined,
          ...(isGift ? { gift: cleanGift(gift) } : {}),
          ...(isLink ? { url: link!, category: cleanCategory(category) || undefined } : {}),
        },
        moveTo,
      )
      void deleteRemovedImages(detailsOf(item, false).images, images)
      if (isLink && pinned !== wasPinned) await setPinnedLink(app.uid, app.member.pinnedLinks, item.id, pinned)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${item.title}"?`)) return
    try {
      await deleteTask(item)
      app.selectTask(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <form className="task-details form" onSubmit={save}>
      <header className="row panel-header">
        <h3 className="grow">Edit {isNote ? 'note' : isLink ? 'link' : list.kind === 'cards' ? 'card' : 'item'}</h3>
        {editable && (
          <button type="submit" className="small" disabled={busy}>
            Save
          </button>
        )}
        <button type="button" className="secondary small" onClick={onDone}>
          Cancel
        </button>
        <button type="button" className="link" onClick={() => app.selectTask(null)} aria-label="Close">
          ✕
        </button>
      </header>
      <fieldset disabled={!editable}>
        <label>
          {isNote ? 'Title' : isLink ? 'Name' : list.kind === 'cards' ? 'Front (the question)' : 'Item'}
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        {isLink && (
          <>
            <label>
              Address
              <input type="text" inputMode="url" autoCapitalize="off" autoCorrect="off" value={url} onChange={(e) => setUrl(e.target.value)} required />
            </label>
            <label>
              Category
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Home/Utilities" />
            </label>
            {app.isMember && (
              <label className="inline">
                <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
                <Icon name="pin" /> Pin to my Align menu (opens in a new tab; just for you)
              </label>
            )}
          </>
        )}
        {isGift && (
          <div className="grid3">
            <label>
              How many
              <input type="number" min={1} max={99} value={gift.qty} onChange={(e) => setGift({ ...gift, qty: e.target.value })} />
            </label>
            <label>
              Color
              <input value={gift.color} onChange={(e) => setGift({ ...gift, color: e.target.value })} />
            </label>
            <label>
              Size
              <input value={gift.size} onChange={(e) => setGift({ ...gift, size: e.target.value })} />
            </label>
          </div>
        )}
        <label>
          {isNote || isLink ? 'Note' : list.kind === 'cards' ? 'Back (the answer)' : 'Details'}
          <AutoTextarea
            rows={isNote ? 8 : 3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isNote ? 'Anything worth keeping: numbers, sizes, passwords, instructions…' : isLink ? 'Anything to remember about it (optional)' : list.kind === 'picks' ? 'Where to watch or hear it, who recommended it…' : 'Size, brand, where to get it…'}
          />
        </label>
        {editable ? (
          <LinksAndPictures value={extras} onChange={(d) => setExtras({ ...extras, ...d })} onError={setError} linkHint={isLink ? 'Another address (optional)' : undefined} />
        ) : (
          <DetailsView links={extras.links} images={extras.images} alt={item.title} />
        )}
        {editable && list.kind !== 'cards' && <NotePicker value={noteIds} onChange={setNoteIds} audience={audienceOf(list)} />}
        {moveChoices.length > 1 && (
          <label>
            {isNote ? 'Notes list' : isLink ? 'Links list' : 'Checklist'}
            <select value={listId} onChange={(e) => setListId(e.target.value)}>
              {moveChoices.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({audienceLabel(audienceOf(l))})
                </option>
              ))}
            </select>
          </label>
        )}
      </fieldset>
      {(() => {
        const target = lists.find((l) => l.id === listId) ?? list
        return <p className="privacy-note small"><Icon name={AUDIENCE_ICON[audienceOf(target)]} /> {privacyText(target, noun, app.household, app.uid)}</p>
      })()}
      {error && <p className="error">{error}</p>}
      {editable && (
        <div className="row">
          <span className="grow" />
          <button type="button" className="danger small" onClick={remove}>
            Delete
          </button>
        </div>
      )}
    </form>
  )
}
