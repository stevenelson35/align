import { collection, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import type { HoldingsSummary, InvestmentList, InvestingSettings, Watchlist } from '../utils/investing'
import { sortInvestmentLists } from '../utils/investing'
import type { Role } from '../types'
import { db } from './config'
import { subscribeInvestmentLists } from './db'

const message = (e: unknown) => e instanceof Error ? e.message : String(e)

/** Deterministic ids + a transaction keep legacy migration safe across tabs and devices. */
async function ensureInvestmentLists(uid: string) {
  await runTransaction(db, async (tx) => {
    const holdings = doc(db, 'investmentLists', `holdings_${uid}`)
    const reports = doc(db, 'investmentLists', `overreactions_${uid}`)
    const old = await tx.get(doc(db, 'investing', uid))
    const h = await tx.get(holdings)
    const r = await tx.get(reports)
    const data = old.data() as InvestingSettings | undefined
    const base = { ownerId: uid, visibility: 'private', viewerVisible: false, updatedAt: serverTimestamp() }
    if (!h.exists()) tx.set(holdings, { ...base, name: 'My investments', kind: 'holdings', symbols: data?.symbols ?? [], positions: data?.positions ?? [] })
    if (!r.exists()) tx.set(reports, { ...base, name: 'Post-earnings overreactions', kind: 'overreactions', symbols: [], positions: [] })
  })
}

export function useInvestmentLists(uid: string, role: Role) {
  const [state, setState] = useState<{ uid: string; lists: InvestmentList[]; error: string | null }>({ uid, lists: [], error: null })
  useEffect(() => {
    let active = true
    const fail = (e: unknown) => { if (active) setState((s) => ({ uid, lists: s.uid === uid ? s.lists : [], error: message(e) })) }
    const unsub = subscribeInvestmentLists(uid, role, (lists) => {
      if (active) setState((s) => ({ uid, lists: sortInvestmentLists(lists), error: s.uid === uid ? s.error : null }))
    }, fail)
    if (role === 'member') ensureInvestmentLists(uid).catch(fail)
    return () => { active = false; unsub() }
  }, [uid, role])
  return state.uid === uid ? state : { uid, lists: [], error: null }
}

export function useInvestmentList(id: string, uid: string) {
  const key = `${uid}:${id}`
  const [state, setState] = useState<{ key: string; list: InvestmentList | null; loaded: boolean; error: string | null }>({ key, list: null, loaded: false, error: null })
  useEffect(() => onSnapshot(doc(db, 'investmentLists', id), (snap) => {
    setState({ key, list: snap.exists() ? { ...snap.data(), id: snap.id } as InvestmentList : null, loaded: true, error: null })
  }, (e) => {
    setState({ key, list: null, loaded: true, error: e.code === 'permission-denied' ? "That investment list isn't shared with you, or it was deleted." : message(e) })
  }), [id, key])
  return state.key === key ? state : { key, list: null, loaded: false, error: null }
}

export function useInvestmentData(list: InvestmentList, uid: string) {
  const [state, setState] = useState<{ key: string; summary: HoldingsSummary | null; watchlist: Watchlist | null; error: string | null }>({ key: '', summary: null, watchlist: null, error: null })
  const key = `${uid}:${list.id}`
  useEffect(() => {
    let active = true
    let revision = 0
    const kind = list.kind === 'holdings' ? 'summary' : 'watchlist'
    const unsub = onSnapshot(doc(db, 'investmentLists', list.id, 'data', kind), async (snap) => {
      const current = ++revision
      try {
        let data = snap.data()
        // The owner's old results remain visible until the updated scanner refreshes these lists.
        if (!data && list.ownerId === uid && list.id === `${list.kind === 'holdings' ? 'holdings' : 'overreactions'}_${uid}`) {
          data = (await getDoc(doc(db, 'investing', uid, 'data', kind))).data()
        }
        if (active && current === revision) setState({ key, summary: kind === 'summary' ? (data as HoldingsSummary | undefined) ?? null : null, watchlist: kind === 'watchlist' ? (data as Watchlist | undefined) ?? null : null, error: null })
      } catch (e) {
        if (active && current === revision) setState({ key, summary: null, watchlist: null, error: message(e) })
      }
    }, (e) => { revision++; if (active) setState({ key, summary: null, watchlist: null, error: message(e) }) })
    return () => { active = false; unsub() }
  }, [key, list.id, list.kind, list.ownerId, uid])
  return state.key === key ? { ...state, loaded: true } : { key, summary: null, watchlist: null, error: null, loaded: false }
}

export async function createInvestmentList(uid: string, name: string) {
  if (!name.trim() || name.trim().length > 100) throw new Error('Use a list name of 1–100 characters.')
  await setDoc(doc(collection(db, 'investmentLists')), { ownerId: uid, name: name.trim(), kind: 'holdings', visibility: 'private', viewerVisible: false, symbols: [], positions: [], updatedAt: serverTimestamp() })
}

export async function saveInvestmentList(list: InvestmentList) {
  if (!list.name.trim() || list.name.trim().length > 100) throw new Error('Use a list name of 1–100 characters.')
  if (list.symbols.length > 100 || list.positions.length > 200) throw new Error('Each list supports up to 100 followed symbols and 200 positions.')
  const { id, ...data } = list
  // Replace rather than merge so old sharedWith/audience fields cannot survive a privacy change.
  await setDoc(doc(db, 'investmentLists', id), { ...data, name: data.name.trim(), updatedAt: serverTimestamp() })
}

export function saveInvestmentStocks(id: string, settings: InvestingSettings) {
  if (settings.symbols.length > 100 || settings.positions.length > 200) throw new Error('Each list supports up to 100 followed symbols and 200 positions.')
  return updateDoc(doc(db, 'investmentLists', id), { ...settings, updatedAt: serverTimestamp() })
}
