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

/** How much of an item is spoken for: claimed (all, incl. bought) and bought, against how many are wanted. */
export function claimState(item: Pick<Task, 'id' | 'gift'>, claims: GiftClaim[]) {
  const mine = claims.filter((c) => c.itemId === item.id)
  const wanted = Math.max(1, item.gift?.qty ?? 1)
  const claimed = mine.reduce((n, c) => n + c.qty, 0)
  const bought = mine.filter((c) => c.bought).reduce((n, c) => n + c.qty, 0)
  return { claims: mine, wanted, claimed, bought, open: Math.max(0, wanted - claimed) }
}

/** "2 · blue · size M": a gift's quantity (when more than one), color and size, for a row. */
export function giftSummary(item: Pick<Task, 'gift'>): string {
  const g = item.gift ?? {}
  return [g.qty && g.qty > 1 ? `×${g.qty}` : '', g.color, g.size ? `size ${g.size}` : ''].filter(Boolean).join(' · ')
}

/** A gift's fields to store: quantity 1–99 (1 is left out), color and size trimmed; undefined when empty. */
export function cleanGift(g: { qty?: number | string; color?: string; size?: string }): Task['gift'] {
  const qty = Math.min(99, Math.max(1, Math.round(Number(g.qty) || 1)))
  const out = { ...(qty > 1 ? { qty } : {}), ...(g.color?.trim() ? { color: g.color.trim().slice(0, 60) } : {}), ...(g.size?.trim() ? { size: g.size.trim().slice(0, 60) } : {}) }
  return Object.keys(out).length ? out : undefined
}
