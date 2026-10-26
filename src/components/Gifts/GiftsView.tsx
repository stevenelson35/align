import { useState, type FormEvent } from 'react'
import { addTaskNow } from '../../firebase/db'
import { ensureSecretList, removeClaim, saveClaim, useGiftClaims } from '../../firebase/gifts'
import { useApp, useData } from '../../hooks/useApp'
import type { GiftClaim, List, Task } from '../../types'
import { canAddIdeas, canClaim, claimState, cleanGift, giftSummary, isRecipient, recipientKey, recipientLabel, secretListFor } from '../../utils/gifts'
import { targetName } from '../../utils/tasks'
import { ListHeader } from '../Tasks/ListHeader'
import { Icon } from '../UI/Icon'

/** When an item was added, so the list keeps the order things were thought of. */
const added = (t: Task) => (t.createdAt ? t.createdAt.seconds : Infinity)

/**
 * A gift list (DESIGN.md §5.12): ideas for one person. Everyone sees the ideas; everyone but the recipient also sees
 * the secret ideas (a hidden companion list) and who's getting what (claims, which the rules keep from the
 * recipient). "I'll get it" claims what's left of an item; tap an item for its details, related notes and your claim.
 */
export function GiftsView({ list }: { list: List }) {
  const app = useApp()
  const { lists, listItems } = useData()
  const mine = isRecipient(list, app.uid)
  const name = recipientLabel(list, app.household)
  const secret = mine ? undefined : secretListFor(list, lists)
  const { claims, error: claimError } = useGiftClaims(mine || !canClaim(app.member.role) ? [] : [recipientKey(list)])
  const items = listItems.filter((t) => t.listId === list.id || (secret && t.listId === secret.id)).sort((a, b) => added(a) - added(b))
  const outside = !list.recipientId
  // A list someone else made and kept from the recipient: everything on it is already a surprise.
  const hidden = !mine && !!list.recipientId && (list.visibility === 'private' ? list.ownerId !== list.recipientId : list.visibility === 'shared' && !list.sharedWith?.includes(list.recipientId))

  return (
    <section className="gifts-view">
      <ListHeader list={list} />
      <p className="gift-banner small">
        <Icon name="gift" />{' '}
        {mine
          ? 'Your list: the family sees it and quietly marks what they’re getting. You won’t see who, or their secret ideas.'
          : outside
            ? `For ${name}, who isn’t in Align: everyone here sees what’s been claimed.`
            : hidden
              ? `For ${name}, and hidden from ${name}: the whole list is a surprise.`
            : `For ${name}. ${name} sees the ideas on this list, but not who’s getting what, or the secret ideas.`}
      </p>
      {canClaim(app.member.role) && <AddGift list={list} secretAllowed={!mine && !outside && !hidden} name={name} />}
      {claimError && <p className="error small">{claimError}</p>}
      <ul className="gift-list">
        {items.map((t) => (
          <GiftRow key={t.id} item={t} list={t.listId === list.id ? list : secret!} secret={t.listId !== list.id} claims={mine ? null : claims} />
        ))}
      </ul>
      {!items.length && <p className="muted small">No ideas yet. {mine ? 'Add what you’d like: sizes, colors, links.' : 'Add one above.'}</p>}
    </section>
  )
}

/** One idea: title, ×qty · color · size, secret / notes / links marks, and (for everyone but the recipient) its claims. */
function GiftRow({ item, list, secret, claims }: { item: Task; list: List; secret: boolean; claims: GiftClaim[] | null }) {
  const app = useApp()
  const summary = giftSummary(item)
  return (
    <li className={`gift-row${app.selectedTaskId === item.id ? ' selected' : ''}`}>
      <button type="button" className="gift-main" onClick={() => app.selectTask(item.id)}>
        <strong>{item.title}</strong>
        <span className="muted small">
          {[summary, item.noteIds?.length ? `${item.noteIds.length} note${item.noteIds.length > 1 ? 's' : ''}` : '', item.links?.length ? 'link' : ''].filter(Boolean).join(' · ')}
          {secret && <span className="badge gift-secret">secret idea</span>}
        </span>
      </button>
      {claims && <ClaimControls item={item} list={list} claims={claims} />}
    </li>
  )
}

/** Who's getting it ("Linda · bought"), and your own claim: I'll get it / Bought / Unclaim. */
export function ClaimControls({ item, list, claims, full = false }: { item: Task; list: List; claims: GiftClaim[]; full?: boolean }) {
  const app = useApp()
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const s = claimState(item, claims)
  const own = s.claims.find((c) => c.claimedBy === app.uid)
  const others = s.claims.filter((c) => c.claimedBy !== app.uid)
  const fail = (err: unknown) => setError(err instanceof Error ? err.message : String(err))
  const save = (patch: Partial<{ qty: number; bought: boolean; note?: string }>) =>
    saveClaim(list, item, app.uid, { qty: own?.qty ?? Math.max(1, s.open), bought: own?.bought ?? false, note: own?.note, ...patch }).catch(fail)
  return (
    <div className={`claim${full ? ' full' : ''}`}>
      {others.map((c) => (
        <span key={c.id} className={`badge claim-badge${c.bought ? ' bought' : ''}`} title={c.note}>
          {targetName(c.claimedBy, app.household)}
          {s.wanted > 1 ? ` ×${c.qty}` : ''}
          {c.bought ? ' · bought' : ''}
        </span>
      ))}
      {canClaim(app.member.role) &&
        (own ? (
          <>
            <button type="button" className={`small ${own.bought ? '' : 'secondary'}`} onClick={() => save({ bought: !own.bought })} aria-pressed={own.bought} title={own.bought ? 'Bought (tap to undo)' : 'Mark bought'}>
              <Icon name="check" /> {own.bought ? 'Bought' : 'Mark bought'}
            </button>
            <button type="button" className="link small" onClick={() => removeClaim(item.id, app.uid).catch(fail)}>
              Unclaim
            </button>
          </>
        ) : (
          s.open > 0 && (
            <button type="button" className="secondary small" onClick={() => save({ qty: s.open, bought: false })} title="Quietly mark that you're getting it">
              <Icon name="gift" /> I’ll get it{s.wanted > 1 ? ` (${s.open})` : ''}
            </button>
          )
        ))}
      {!own && s.open === 0 && !others.length && <span className="muted small">Taken</span>}
      {full && own && (
        <div className="claim-more">
          {s.wanted > 1 && (
            <label className="inline small">
              How many you’re getting
              <input type="number" min={1} max={99} value={own.qty} onChange={(e) => save({ qty: Number(e.target.value) || 1 })} style={{ width: '4.5rem' }} />
            </label>
          )}
          <label className="small">
            Your note (only the family, never the recipient): where, price, wrapped?
            <input
              value={note ?? own.note ?? ''}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => note !== null && note !== (own.note ?? '') && save({ note })}
              maxLength={500}
              placeholder="Target, $25, wrapped"
            />
          </label>
        </div>
      )}
      {error && <span className="error small">{error}</span>}
    </div>
  )
}

/** Add an idea: what, how many, color, size, details; for others' lists, a secret idea (hidden from the recipient). */
function AddGift({ list, secretAllowed, name }: { list: List; secretAllowed: boolean; name: string }) {
  const app = useApp()
  const { lists } = useData()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [qty, setQty] = useState('1')
  const [color, setColor] = useState('')
  const [size, setSize] = useState('')
  const [details, setDetails] = useState('')
  const canPublic = canAddIdeas(list, app.member.role, app.canEdit(list))
  const [secret, setSecret] = useState(secretAllowed)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const asSecret = secretAllowed && (secret || !canPublic)
  if (!canPublic && !secretAllowed) return null

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    setError(null)
    try {
      const target = asSecret ? await ensureSecretList(list, lists, app.household, app.uid) : list
      await addTaskNow(
        target,
        { title: title.trim(), notes: details.trim() || undefined, gift: cleanGift({ qty, color, size }), priority: 2, status: 'todo', context: target.defaultContext, durationDays: 1, dependsOn: [] },
        app.uid,
      ).written
      setTitle('')
      setQty('1')
      setColor('')
      setSize('')
      setDetails('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    setBusy(false)
  }

  if (!open)
    return (
      <button type="button" className="secondary small add-gift-open" onClick={() => setOpen(true)}>
        <Icon name="plus" /> Add an idea
      </button>
    )
  return (
    <form className="add-gift form" onSubmit={add}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What (e.g. Shorts)" aria-label="Gift" autoFocus required />
      <div className="grid3">
        <label className="small">
          How many
          <input type="number" min={1} max={99} value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
        <label className="small">
          Color
          <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Navy" />
        </label>
        <label className="small">
          Size
          <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="M, 34x30…" />
        </label>
      </div>
      <textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Details: brand, style, where to get it… (link a note with sizes after adding: tap the idea → Edit)" aria-label="Details" />
      {secretAllowed && canPublic && (
        <label className="inline small">
          <input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} />
          Secret idea (hidden from {name})
        </label>
      )}
      {secretAllowed && !canPublic && <p className="muted small">This adds a secret idea (hidden from {name}); only the list’s owner adds to the list itself.</p>}
      {error && <p className="error small">{error}</p>}
      <div className="row">
        <button type="submit" className="small" disabled={busy || !title.trim()}>
          <Icon name="plus" /> Add
        </button>
        <button type="button" className="link small" onClick={() => setOpen(false)}>
          Done
        </button>
      </div>
    </form>
  )
}
