import { saveClaim, useGiftClaims } from '../../firebase/gifts'
import { useApp, useData } from '../../hooks/useApp'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { canClaim, claimState, isRecipient, recipientKey, recipientLabel, secretListFor } from '../../utils/gifts'
import { Icon } from '../UI/Icon'
import { SectionHeader } from '../UI/SectionHeader'

/**
 * Gifts on the Today page: what you've said you'll get (tick when bought), then each gift list with how many ideas
 * are still open (not for your own list: you don't see claims). Starts folded; remembered on this device.
 */
export function GiftsStrip() {
  const app = useApp()
  const { lists, listItems } = useData()
  const [open, setOpen] = useStoredFlag('align-today-gifts', false)
  const giftLists = lists.filter((l) => l.kind === 'gifts' && !l.giftSecret).sort((a, b) => a.name.localeCompare(b.name))
  const others = giftLists.filter((l) => !isRecipient(l, app.uid))
  const { claims } = useGiftClaims(canClaim(app.member.role) ? others.map(recipientKey) : [])
  if (!giftLists.length && !app.isMember) return null
  const shopping = claims.filter((c) => c.claimedBy === app.uid).sort((a, b) => Number(a.bought) - Number(b.bought) || a.title.localeCompare(b.title))
  const toBuy = shopping.filter((c) => !c.bought).length
  const listOf = (id: string) => lists.find((l) => l.id === id)

  return (
    <div className="day-section gifts-strip">
      <SectionHeader icon="gift" title="Gifts" count={toBuy ? `${toBuy} to buy` : giftLists.length} onTitleClick={() => setOpen(!open)} expanded={open} help="gifts">
        {app.isMember && (
          <button type="button" className="link small header-add" onClick={() => app.editList(null, 'gifts')} title="New gift list" aria-label="New gift list">
            <Icon name="plus" />
          </button>
        )}
        <button type="button" className="link small" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'}
        </button>
      </SectionHeader>
      {open && (
        <>
          {shopping.length > 0 && (
            <>
              <h4 className="small muted">You’re getting</h4>
              <ul className="gift-shopping">
                {shopping.map((c) => {
                  const list = listOf(c.listId)
                  const gone = !listItems.some((t) => t.id === c.itemId)
                  return (
                    <li key={c.id} className="row">
                      <label className="inline grow">
                        <input type="checkbox" checked={c.bought} disabled={!list} onChange={(e) => list && void saveClaim(list, { id: c.itemId, title: c.title }, app.uid, { qty: c.qty, bought: e.target.checked, note: c.note })} />
                        <span className={c.bought ? 'muted' : ''}>
                          {c.title}
                          {c.qty > 1 ? ` ×${c.qty}` : ''}
                        </span>
                      </label>
                      <span className="muted small">
                        for {list ? recipientLabel(list, app.household) : 'someone'}
                        {gone ? ' · removed from the list' : ''}
                      </span>
                      {!gone && (
                        <button type="button" className="link small" onClick={() => app.selectTask(c.itemId)} aria-label={`Open ${c.title}`}>
                          Open
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
          {!giftLists.length && <p className="muted small">No gift lists yet: + makes one (for someone in the family, yourself, or anyone).</p>}
          <ul className="gift-lists small">
            {giftLists.map((l) => {
              const mine = isRecipient(l, app.uid)
              const secret = mine ? undefined : secretListFor(l, lists)
              const items = listItems.filter((t) => t.listId === l.id || (secret && t.listId === secret.id))
              const openCount = items.filter((t) => claimState(t, claims).open > 0).length
              return (
                <li key={l.id}>
                  <button type="button" className="link" onClick={() => app.navigate({ view: 'list', listId: l.id, timeline: false })}>
                    <Icon name="gift" /> {l.name}
                  </button>{' '}
                  <span className="muted">
                    {mine ? `your list · ${items.length} idea${items.length === 1 ? '' : 's'}` : `for ${recipientLabel(l, app.household)} · ${openCount} of ${items.length} still open`}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
