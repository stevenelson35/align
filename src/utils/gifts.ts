// Gift lists (DESIGN.md §5.12): a list of gift ideas for one person, plus a hidden companion list of surprise ideas,
// and claims (who is getting what) that the rules never show the recipient. Pure helpers, unit-tested.
import type { GiftClaim, Household, List, Task } from '../types'

/** Who a gift list is for, as stored on claims: their uid, or "name:<name>" for someone outside the household. */
export const recipientKey = (list: Pick<List, 'recipientId' | 'recipientName'>) => list.recipientId ?? `name:${list.recipientName ?? ''}`

/** The recipient's name for people: the member's display name, the typed name, or "someone". */
export function recipientLabel(list: Pick<List, 'recipientId' | 'recipientName'>, household: Household): string {
  return (list.recipientId ? household.members[list.recipientId]?.displayName : list.recipientName) || 'someone'
}

/** Whether this account can claim gifts: any household account, view-only ones included. */
export const canClaim = (role: string) => role === 'member' || role === 'viewer'

/**
 * Whether you can add ideas to a gift list itself: if you can edit it, or as a view-only account when its owner
 * hasn't narrowed who edits (the rules say the same). Secret ideas are open to anyone who can claim.
 */
export const canAddIdeas = (list: Pick<List, 'editAudience'>, role: string, canEdit: boolean) =>
  canEdit || (role === 'viewer' && (!list.editAudience || list.editAudience === 'family' || list.editAudience === 'everyone'))

/** A view-only account's own gift idea, which it may change or remove (nothing else). */
export const ownGiftIdea = (item: Pick<Task, 'createdBy'>, list: Pick<List, 'kind'>, role: string, uid: string) => list.kind === 'gifts' && role === 'viewer' && item.createdBy === uid

/** Whether you're the person a gift list is for (then claims and secret ideas are hidden from you). */
export const isRecipient = (list: Pick<List, 'recipientId'>, uid: string) => !!list.recipientId && list.recipientId === uid

/**
 * Everyone a secret companion (or a list hidden from its recipient) is shared with: every household account, view-only
 * ones too (they can claim), except the recipient and the helper account.
 */
export function secretSharedWith(household: Household, recipientId: string, ownerId: string): string[] {
  const ids = Object.entries(household.members)
    .filter(([id, m]) => !m.bot && (m.role === 'member' || m.role === 'viewer') && id !== recipientId)
    .map(([id]) => id)
  return [...new Set([ownerId, ...ids])]
}

/** A gift list's secret companion (surprise ideas for the same person), if you can see one. */
export const secretListFor = (list: List, lists: List[]) => lists.find((l) => l.kind === 'gifts' && l.giftSecret && l.secretOf === list.id)

/**
 * How much of an item is spoken for: claimed (all, incl. bought) and bought, against how many are wanted; for a group
 * gift, how much has been pledged against its price (open until the pledges reach it).
 */
export function claimState(item: Pick<Task, 'id' | 'gift'>, claims: GiftClaim[]) {
  const mine = claims.filter((c) => c.itemId === item.id)
  const wanted = Math.max(1, item.gift?.qty ?? 1)
  const claimed = mine.reduce((n, c) => n + c.qty, 0)
  const bought = mine.filter((c) => c.bought).reduce((n, c) => n + c.qty, 0)
  const pledged = mine.reduce((n, c) => n + (c.amount ?? 0), 0)
  if (item.gift?.pool) {
    const price = item.gift.price ?? 0
    const open = price ? Math.max(0, price - pledged) : 1
    return { claims: mine, wanted: 1, claimed: open ? 0 : 1, bought, open: open ? 1 : 0, pledged, still: price ? open : null }
  }
  return { claims: mine, wanted, claimed, bought, open: Math.max(0, wanted - claimed), pledged, still: null as number | null }
}

/** Where an item stands for givers: nobody's on it, some of it is (one of two, part of a group gift), or all of it. */
export function giftStatus(item: Pick<Task, 'id' | 'gift'>, claims: GiftClaim[]): 'open' | 'partial' | 'claimed' {
  const s = claimState(item, claims)
  if (!s.claims.length) return 'open'
  return s.open > 0 ? 'partial' : 'claimed'
}

/** "$25", "$12.50": a gift's price estimate. */
export const priceText = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`

export const GIFT_SORTS = ['priority', 'cheap', 'pricey', 'newest'] as const
export type GiftSort = (typeof GIFT_SORTS)[number]
export const GIFT_SHOWS = ['all', 'open', 'claimed'] as const
export type GiftShow = (typeof GIFT_SHOWS)[number]

const addedAt = (t: Pick<Task, 'createdAt'>) => (t.createdAt ? t.createdAt.seconds : Infinity)

/**
 * Gift ideas in an order: by priority (#1 first; unranked ones after, oldest first), price low→high or high→low (no
 * price last), or newest first.
 */
export function sortGifts<T extends Pick<Task, 'gift' | 'createdAt' | 'title'>>(items: T[], by: GiftSort): T[] {
  const rank = (t: T) => t.gift?.rank ?? Infinity
  const price = (t: T) => t.gift?.price
  return [...items].sort((a, b) => {
    if (by === 'priority') return rank(a) - rank(b) || addedAt(a) - addedAt(b)
    if (by === 'newest') return addedAt(b) - addedAt(a)
    const pa = price(a)
    const pb = price(b)
    if (pa === undefined || pb === undefined) return (pa === undefined ? 1 : 0) - (pb === undefined ? 1 : 0) || rank(a) - rank(b)
    return (by === 'cheap' ? pa - pb : pb - pa) || rank(a) - rank(b)
  })
}

/** Only what's still to get ('open': nobody, or not all of it), only what's spoken for, or everything. */
export function showGifts<T extends Pick<Task, 'id' | 'gift'>>(items: T[], show: GiftShow, claims: GiftClaim[]): T[] {
  if (show === 'all') return items
  return items.filter((t) => (show === 'open' ? giftStatus(t, claims) !== 'claimed' : giftStatus(t, claims) !== 'open'))
}

/** New priorities for ideas in this order (1, 2, 3…): only the ones whose number changes. */
export function reRank(ordered: Pick<Task, 'id' | 'gift'>[]): { id: string; rank: number }[] {
  return ordered.map((t, i) => ({ id: t.id, rank: i + 1 })).filter((r, i) => ordered[i].gift?.rank !== r.rank)
}

/** "×2 · blue · size M · about $25": a gift's quantity (when more than one), color, size and price, for a row. */
export function giftSummary(item: Pick<Task, 'gift'>): string {
  const g = item.gift ?? {}
  return [g.qty && g.qty > 1 && !g.pool ? `×${g.qty}` : '', g.color, g.size ? `size ${g.size}` : '', g.price !== undefined ? `about ${priceText(g.price)}` : ''].filter(Boolean).join(' · ')
}

/**
 * A gift's fields to store: quantity 1–99 (1 is left out), color and size trimmed, a price 0–100,000 (cents kept),
 * its priority kept as it was, and the group-gift flag; undefined when empty.
 */
export function cleanGift(g: { qty?: number | string; color?: string; size?: string; price?: number | string; rank?: number; pool?: boolean }): Task['gift'] {
  const qty = Math.min(99, Math.max(1, Math.round(Number(g.qty) || 1)))
  const rawPrice = typeof g.price === 'string' ? g.price.replace(/[$,\s]/g, '') : g.price
  const price = rawPrice === '' || rawPrice === undefined || !Number.isFinite(Number(rawPrice)) ? undefined : Math.min(100000, Math.max(0, Math.round(Number(rawPrice) * 100) / 100))
  const out = {
    ...(qty > 1 ? { qty } : {}),
    ...(g.color?.trim() ? { color: g.color.trim().slice(0, 60) } : {}),
    ...(g.size?.trim() ? { size: g.size.trim().slice(0, 60) } : {}),
    ...(price !== undefined ? { price } : {}),
    ...(g.rank ? { rank: g.rank } : {}),
    ...(g.pool ? { pool: true } : {}),
  }
  return Object.keys(out).length ? out : undefined
}

/**
 * Where a gift wanted more than once stands, in words: "1 of 2 still needed", "All 2 taken" (nothing when nobody's
 * on it yet, or it's just one, or a group gift).
 */
export function qtyLine(s: { wanted: number; open: number; claims: unknown[] }, pool = false): string {
  if (pool || s.wanted <= 1 || !s.claims.length) return ''
  return s.open > 0 ? `${s.open} of ${s.wanted} still needed` : `All ${s.wanted} taken`
}

/** A PayPal.me or Venmo name as typed ("@sam-w", "paypal.me/SamW", "venmo.com/u/sam") → "sam-w", or '' if not one. */
export function cleanPayName(raw: string | undefined): string {
  const name = (raw ?? '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^(www\.)?(paypal\.me|venmo\.com(\/u)?)\//i, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '')
  return /^[A-Za-z0-9_.-]{1,40}$/.test(name) ? name : ''
}

/**
 * Links that open PayPal or Venmo ready to send an amount to the gift list's person, with a note. Align never holds
 * the money: the pledge stays a pledge in Align, and the giver marks it Sent.
 */
export function payLinks(payTo: { paypal?: string; venmo?: string } | undefined, amount: number, note: string): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = []
  const paypal = cleanPayName(payTo?.paypal)
  const venmo = cleanPayName(payTo?.venmo)
  const sum = Math.round(amount * 100) / 100
  if (paypal) out.push({ label: 'PayPal', url: `https://paypal.me/${encodeURIComponent(paypal)}/${sum}USD` })
  if (venmo) out.push({ label: 'Venmo', url: `https://venmo.com/${encodeURIComponent(venmo)}?txn=pay&amount=${sum}&note=${encodeURIComponent(note.slice(0, 100))}` })
  return out
}
