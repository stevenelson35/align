import { useState } from 'react'
import { saveGiftPlan, useGiftClaims, useGiftPlans } from '../../firebase/gifts'
import type { GiftClaim, GiftPlan, GiftPlanStatus, List } from '../../types'
import { useApp, useData } from '../../hooks/useApp'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { canClaim, claimState, isRecipient, recipientKey, recipientLabel, secretListFor } from '../../utils/gifts'
import { Icon } from '../UI/Icon'
import { SectionHeader } from '../UI/SectionHeader'
import { ListRow } from '../UI/ListRow'
import { MakeWishList } from './MakeWishList'
import { useTodayExpansion } from '../../hooks/useTodaySection'

/**
 * Gifts on the Today page: a concealed shopping list, then each gift list with how many ideas
 * are still open (not for your own list: you don't see claims). Starts folded; remembered on this device.
 */
export function GiftsStrip() {
  const app = useApp()
  const { lists, listItems } = useData()
  const [open, saveOpen] = useStoredFlag('align-today-gifts', false)
  const setOpen = useTodayExpansion(open, saveOpen)
  const giftLists = lists.filter((l) => l.kind === 'gifts' && !l.giftSecret).sort((a, b) => a.name.localeCompare(b.name))
  const others = giftLists.filter((l) => !isRecipient(l, app.uid))
  const { claims, error: claimsError } = useGiftClaims(canClaim(app.member.role) ? others.map(recipientKey) : [])
  const { plans, error: plansError } = useGiftPlans(app.uid, canClaim(app.member.role))
  if (!giftLists.length && !app.canPlay) return null
  const needsBuying = (c: GiftClaim) => (plans[c.itemId]?.status ?? (c.bought ? 'bought' : 'to-buy')) === 'to-buy'
  const shopping = claims.filter((c) => c.claimedBy === app.uid).sort((a, b) => Number(needsBuying(b)) - Number(needsBuying(a)) || a.title.localeCompare(b.title))
  const toBuy = shopping.filter(needsBuying).length

  return (
    <div className="day-section gifts-strip">
      <SectionHeader icon="gift" title="Gifts" count={toBuy ? `${toBuy} to buy` : giftLists.length} onTitleClick={() => setOpen(!open)} expanded={open} help="gifts">
        {app.canPlay && (
          <button type="button" className="link small header-add" onClick={() => app.editList(null, 'gifts')} title="New gift list" aria-label="New gift list">
            <Icon name="plus" />
          </button>
        )}
        <button type="button" className="link small" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'}
        </button>
      </SectionHeader>
      {/* No wish list of your own yet: the way to make one, without opening anything. */}
      <div className="tile-body gift-wish-prompt">
        <MakeWishList className="secondary small" />
      </div>
      {open && (
        <div className="tile-body">
          {shopping.length > 0 && (
            <ShoppingPanel shopping={shopping} plans={plans} lists={lists} itemIds={new Set(listItems.map((item) => item.id))} />
          )}
          {(claimsError || plansError) && <p className="error small">{claimsError || plansError}</p>}
          {!giftLists.length && <p className="muted small">No gift lists yet: + makes one for someone else.</p>}
          {/* Each gift list as a line, like a folder's tiles. */}
          <div className="kind-rows">
            {giftLists.map((l) => {
              const mine = isRecipient(l, app.uid)
              const secret = mine ? undefined : secretListFor(l, lists)
              const items = listItems.filter((t) => t.listId === l.id || (secret && t.listId === secret.id))
              const openCount = items.filter((t) => claimState(t, claims).open > 0).length
              return (
                <ListRow
                  key={l.id}
                  icon="gift"
                  name={l.name}
                  status={mine ? `your list · ${items.length} idea${items.length === 1 ? '' : 's'}` : `for ${recipientLabel(l, app.household)} · ${openCount} of ${items.length} open`}
                  onOpen={() => app.navigate({ view: 'list', listId: l.id, timeline: false })}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ShoppingPanel({ shopping, plans, lists, itemIds }: { shopping: GiftClaim[]; plans: Record<string, GiftPlan>; lists: List[]; itemIds: Set<string> }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="gift-shopping-panel">
      <button type="button" className="link" aria-expanded={open} onClick={() => setOpen(!open)}>
        You’re getting · {open ? 'Hide' : 'Show'}
      </button>
      {open && (
        <>
          <p className="small muted">Status and notes here are private. They do not change the bought mark shared with other givers.</p>
          <ul className="gift-shopping">
            {shopping.map((claim) => (
              <ShoppingItem key={claim.id} claim={claim} plan={plans[claim.itemId]} list={lists.find((list) => list.id === claim.listId)} gone={!itemIds.has(claim.itemId)} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function ShoppingItem({ claim, plan, list, gone }: { claim: GiftClaim; plan?: GiftPlan; list?: List; gone: boolean }) {
  const app = useApp()
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  async function save(patch: GiftPlan) {
    setSaving(true)
    setError(null)
    try {
      await saveGiftPlan(app.uid, claim.itemId, patch)
      if (patch.note !== undefined) setNote(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <li className="gift-shopping-item">
      <div className="row wrap">
        <strong>{claim.title}{claim.qty > 1 ? ` ×${claim.qty}` : ''}</strong>
        <span className="muted small">for {list ? recipientLabel(list, app.household) : 'someone'}{gone ? ' · removed from the list' : ''}</span>
        {!gone && <button type="button" className="link small" onClick={() => app.selectTask(claim.itemId)}>Open</button>}
      </div>
      <label className="small">
        Private status{' '}
        <select aria-label={`Private status for ${claim.title}`} value={plan?.status ?? (claim.bought ? 'bought' : 'to-buy')} disabled={saving} onChange={(e) => void save({ status: e.target.value as GiftPlanStatus })}>
          <option value="to-buy">To buy</option>
          <option value="bought">Bought</option>
          <option value="wrapped">Wrapped</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
        </select>
      </label>
      <label className="small gift-plan-note">
        Private notes
        <textarea value={note ?? plan?.note ?? ''} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="Coupon, where to buy, or other details" />
      </label>
      {note !== null && note !== (plan?.note ?? '') && <button type="button" className="secondary small" disabled={saving} onClick={() => void save({ note })}>Save notes</button>}
      {error && <p className="error small">{error}</p>}
    </li>
  )
}
