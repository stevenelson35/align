import { useRef, useState, type FormEvent } from 'react'
import { useStoredChoice } from '../../hooks/useStoredChoice'
import { addTaskNow } from '../../firebase/db'
import { ensureSecretList, removeClaim, saveClaim, setGiftRanks, useGiftClaims } from '../../firebase/gifts'
import { useApp, useData } from '../../hooks/useApp'
import type { GiftClaim, List, Task } from '../../types'
import { canAddIdeas, canClaim, claimState, cleanGift, giftStatus, giftSummary, GIFT_SHOWS, GIFT_SORTS, isRecipient, priceText, recipientKey, recipientLabel, reRank, secretListFor, showGifts, sortGifts, type GiftShow, type GiftSort } from '../../utils/gifts'
import { targetName } from '../../utils/tasks'
import { ListHeader } from '../Tasks/ListHeader'
import { Icon } from '../UI/Icon'
import { EntryRow } from '../Entries/EntryRow'
import { EntrySizeSwitch } from '../Entries/EntrySizeSwitch'
import { useEntrySize } from '../../hooks/useEntrySize'
import type { EntrySize } from '../../utils/entries'

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
  const ideas = listItems.filter((t) => t.listId === list.id)
  const secretIdeas = secret ? listItems.filter((t) => t.listId === secret.id) : []
  const items = [...ideas, ...secretIdeas]
  const outside = !list.recipientId
  // Sort and show (this device): priority / price either way / newest; everything, what's still to get, what's taken.
  const [sort, setSort] = useStoredChoice<GiftSort>('align-gift-sort', GIFT_SORTS, 'priority')
  const [show, setShow] = useStoredChoice<GiftShow>('align-gift-show', GIFT_SHOWS, 'all')
  const [arranging, setArranging] = useState(false)
  const seesClaims = !mine && canClaim(app.member.role)
  const canRank = app.canEdit(list) && app.member.role === 'member'
  const view = (list_: Task[]) => showGifts(sortGifts(list_, sort), seesClaims ? show : 'all', claims)
  // A list someone else made and kept from the recipient: everything on it is already a surprise.
  const [size, setSize] = useEntrySize(list)
  const hidden = !mine && !!list.recipientId && (list.visibility === 'private' ? list.ownerId !== list.recipientId : list.visibility === 'shared' && !list.sharedWith?.includes(list.recipientId))

  return (
    <section className="gifts-view">
      <ListHeader list={list}>
        <EntrySizeSwitch value={size} onChange={setSize} />
      </ListHeader>
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
      {canClaim(app.member.role) && !arranging && <AddGift list={list} secretAllowed={!mine && !outside && !hidden} name={name} />}
      {claimError && <p className="error small">{claimError}</p>}
      {items.length > 1 && !arranging && (
        <div className="gift-tools">
          <label className="small">
            Sort{' '}
            <select value={sort} onChange={(e) => setSort(e.target.value as GiftSort)} aria-label="Sort the ideas">
              <option value="priority">Priority</option>
              <option value="cheap">Price: low to high</option>
              <option value="pricey">Price: high to low</option>
              <option value="newest">Newest</option>
            </select>
          </label>
          {seesClaims && (
            <span className="segmented small" role="group" aria-label="Show">
              {GIFT_SHOWS.map((v) => (
                <button key={v} type="button" className={show === v ? 'on' : ''} aria-pressed={show === v} onClick={() => setShow(v)}>
                  {v === 'all' ? 'All' : v === 'open' ? 'Not claimed' : 'Claimed'}
                </button>
              ))}
            </span>
          )}
          {canRank && ideas.length > 1 && (
            <button type="button" className="link small" onClick={() => setArranging(true)}>
              Arrange by priority
            </button>
          )}
        </div>
      )}
      {arranging ? (
        <GiftRankArrange items={sortGifts(ideas, 'priority')} onDone={() => setArranging(false)} />
      ) : (
        <>
          <ul className="entry-list gift-list">
            {view(ideas).map((t) => (
              <GiftRow key={t.id} item={t} list={list} secret={false} claims={mine ? null : claims} size={size} mark={seesClaims && show === 'all'} />
            ))}
          </ul>
          {secretIdeas.length > 0 && (
            <>
              <h3 className="gift-secret-heading small">
                <Icon name="lock" /> Secret ideas <span className="muted">(hidden from {name})</span>
              </h3>
              <ul className="entry-list gift-list">
                {view(secretIdeas).map((t) => (
                  <GiftRow key={t.id} item={t} list={secret!} secret claims={claims} size={size} mark={seesClaims && show === 'all'} />
                ))}
              </ul>
            </>
          )}
          {items.length > 0 && seesClaims && show !== 'all' && !view(items).length && (
            <p className="muted small">{show === 'open' ? 'Everything here is claimed.' : 'Nothing is claimed yet.'}</p>
          )}
        </>
      )}
      {!items.length && <p className="muted small">No ideas yet. {mine ? 'Add what you’d like: sizes, colors, links, about what it costs.' : 'Add one above.'}</p>}
    </section>
  )
}

/**
 * One idea as an entry row: title; medium adds ×qty · color · size, the secret badge and (for everyone but the
 * recipient) who's getting it, with I'll get it / Bought.
 */
function GiftRow({ item, list, secret, claims, size, mark = false }: { item: Task; list: List; secret: boolean; claims: GiftClaim[] | null; size: EntrySize; /** Show ✓ / ◐ (when all ideas are shown). */ mark?: boolean }) {
  const summary = giftSummary(item)
  const status = claims ? giftStatus(item, claims) : 'open'
  const rank = !secret ? item.gift?.rank : undefined
  return (
    <EntryRow
      entry={item}
      size={size}
      className={status !== 'open' && mark ? `gift-${status}` : ''}
      lead={
        rank || (mark && status !== 'open') ? (
          <span className="gift-lead">
            {rank ? <span className="gift-rank" title={`Priority ${rank}`}>#{rank}</span> : null}
            {mark && status !== 'open' && (
              <span className={`gift-state ${status}`} title={status === 'claimed' ? 'Claimed' : 'Partly claimed: some still to get'} aria-label={status === 'claimed' ? 'Claimed' : 'Partly claimed'}>
                {status === 'claimed' ? '✓' : '◐'}
              </span>
            )}
          </span>
        ) : undefined
      }
      chips={
        <>
          {summary && <span>{summary}</span>}
          {item.noteIds?.length ? <span>{`${item.noteIds.length} note${item.noteIds.length > 1 ? 's' : ''}`}</span> : null}
          {secret && <span className="badge gift-secret">secret idea</span>}
          {claims && <ClaimControls item={item} list={list} claims={claims} />}
        </>
      }
    />
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
  const pool = !!item.gift?.pool
  const [pledging, setPledging] = useState<string | null>(null)
  const fail = (err: unknown) => setError(err instanceof Error ? err.message : String(err))
  const save = (patch: Partial<{ qty: number; bought: boolean; note?: string; amount?: number }>) =>
    saveClaim(list, item, app.uid, { qty: pool ? 1 : (own?.qty ?? Math.max(1, s.open)), bought: own?.bought ?? false, note: own?.note, amount: own?.amount, ...patch }).catch(fail)
  const pledge = () => {
    const amount = Number(String(pledging ?? '').replace(/[$,\s]/g, ''))
    if (!(amount > 0)) return setError('Type how much you’re putting in.')
    setError(null)
    setPledging(null)
    void save({ amount })
  }
  return (
    <div className={`claim${full ? ' full' : ''}`}>
      {pool && (
        <span className="badge gift-pool" title="A group gift: people chip in toward it">
          {priceText(s.pledged)} {item.gift?.price !== undefined ? `of ${priceText(item.gift.price)}` : 'pledged'}
          {s.still ? ` · ${priceText(s.still)} to go` : s.still === 0 ? ' · covered' : ''}
        </span>
      )}
      {others.map((c) => (
        <span key={c.id} className={`badge claim-badge${c.bought ? ' bought' : ''}`} title={c.note}>
          {targetName(c.claimedBy, app.household)}
          {pool && c.amount ? ` ${priceText(c.amount)}` : s.wanted > 1 ? ` ×${c.qty}` : ''}
          {c.bought ? ' · bought' : ''}
          {c.note ? ` · “${c.note}”` : ''}
        </span>
      ))}
      {pool && canClaim(app.member.role) && pledging !== null && (
        <span className="pledge row">
          <input inputMode="decimal" value={pledging} onChange={(e) => setPledging(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && pledge()} aria-label="How much you’re putting in" placeholder="$" autoFocus />
          <button type="button" className="small" onClick={pledge}>
            Save
          </button>
          <button type="button" className="link small" onClick={() => setPledging(null)}>
            Cancel
          </button>
        </span>
      )}
      {pool && canClaim(app.member.role) && pledging === null && (
        <>
          <button type="button" className="secondary small" onClick={() => setPledging(String(own?.amount ?? s.still ?? ''))} title="Put money (or a gift card) toward it">
            <Icon name="coin" /> {own ? `You: ${priceText(own.amount ?? 0)} (change)` : 'Chip in'}
          </button>
          {own && (
            <button type="button" className="link small" onClick={() => removeClaim(item.id, app.uid).catch(fail)}>
              Take back
            </button>
          )}
        </>
      )}
      {!pool && canClaim(app.member.role) &&
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
      {!pool && !own && s.open === 0 && !others.length && <span className="muted small">Taken</span>}
      {full && own && (
        <div className="claim-more">
          {s.wanted > 1 && !pool && (
            <label className="inline small">
              How many you’re getting
              <input type="number" min={1} max={99} value={own.qty} onChange={(e) => save({ qty: Number(e.target.value) || 1 })} style={{ width: '4.5rem' }} />
            </label>
          )}
          <label className="small">
            Your note (the other givers see it, never the recipient): which one, where, wrapped?
            <input
              value={note ?? own.note ?? ''}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => note !== null && note !== (own.note ?? '') && save({ note })}
              maxLength={500}
              placeholder="Got the blue one, Target, wrapped"
            />
          </label>
        </div>
      )}
      {error && <span className="error small">{error}</span>}
    </div>
  )
}

/**
 * Arrange by priority (whoever keeps the list): drag ⠿ or use ↑ ↓; the numbers follow the order (#1 = most wanted)
 * and are saved as you go. Ideas without a number yet get one the first time you arrange.
 */
function GiftRankArrange({ items, onDone }: { items: Task[]; onDone: () => void }) {
  const [order, setOrder] = useState<Task[] | null>(null)
  const [held, setHeld] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const box = useRef<HTMLOListElement>(null)
  const shown = order ?? items
  const save = (next: Task[]) => {
    setError(null)
    const changes = reRank(next)
    if (changes.length) setGiftRanks(changes, next).catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }
  const move = (from: number, to: number) => {
    if (to < 0 || to >= shown.length) return
    const next = [...shown]
    const [t] = next.splice(from, 1)
    next.splice(to, 0, t)
    save(next)
  }
  function dragTo(y: number) {
    if (!held || !box.current) return
    const rows = [...box.current.querySelectorAll<HTMLElement>('[data-id]')].filter((r) => r.dataset.id !== held)
    const to = rows.filter((r) => {
      const b = r.getBoundingClientRect()
      return b.top + b.height / 2 < y
    }).length
    const from = shown.findIndex((t) => t.id === held)
    if (from !== to) {
      const next = [...shown]
      const [t] = next.splice(from, 1)
      next.splice(to, 0, t)
      setOrder(next)
    }
    if (y < 70) window.scrollBy(0, -12)
    else if (y > window.innerHeight - 90) window.scrollBy(0, 12)
  }
  return (
    <div className="gift-arrange">
      <div className="row">
        <strong className="grow">Arrange by priority</strong>
        <button type="button" className="small" onClick={onDone}>
          Done
        </button>
      </div>
      <p className="muted small">Most wanted first: drag ⠿ (or use ↑ ↓). Everyone sees the numbers; sort by Priority to see them in this order.</p>
      <ol className="arrange-list" ref={box}>
        {shown.map((t, i) => (
          <li key={t.id} data-id={t.id} className={`arrange-row${held === t.id ? ' dragging' : ''}`}>
            <span
              className="drag-handle"
              aria-hidden="true"
              onPointerDown={(e) => {
                e.preventDefault()
                e.currentTarget.setPointerCapture(e.pointerId)
                setHeld(t.id)
                setOrder(shown)
              }}
              onPointerMove={(e) => held && dragTo(e.clientY)}
              onPointerUp={() => {
                if (order) save(order)
                setHeld(null)
                setOrder(null)
              }}
              onPointerCancel={() => {
                setHeld(null)
                setOrder(null)
              }}
            >
              ⠿
            </span>
            <span className="gift-rank">#{i + 1}</span>
            <span className="grow arrange-label">
              {t.title} {t.gift?.price !== undefined && <span className="muted small">{priceText(t.gift.price)}</span>}
            </span>
            <button type="button" className="row-action" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move ${t.title} up`} title="Move up">↑</button>
            <button type="button" className="row-action" disabled={i === shown.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move ${t.title} down`} title="Move down">↓</button>
          </li>
        ))}
      </ol>
      {error && <p className="error small">{error}</p>}
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
  const [price, setPrice] = useState('')
  const [pool, setPool] = useState(false)
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
        { title: title.trim(), notes: details.trim() || undefined, gift: cleanGift({ qty, color, size, price, pool }), priority: 2, status: 'todo', context: target.defaultContext, durationDays: 1, dependsOn: [] },
        app.uid,
      ).written
      setTitle('')
      setQty('1')
      setColor('')
      setSize('')
      setPrice('')
      setPool(false)
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
      <div className="row wrap gift-price-row">
        <label className="small">
          About how much
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$25" style={{ width: '7rem' }} />
        </label>
        <label className="inline small" title="Several people can chip in toward it; everyone but the person it's for sees the running total">
          <input type="checkbox" checked={pool} onChange={(e) => setPool(e.target.checked)} /> Group gift: people chip in
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
