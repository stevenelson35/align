// Investing (DESIGN.md §5.13): your own stocks on investing/{uid} (symbols and positions, private to you), with the
// market scanner's results under investing/{uid}/data (summary = today's look at your stocks; watchlist = the
// post-earnings candidates). The scanner is the household's helper account running scripts/market-scanner.
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import type { HoldingsSummary, InvestingSettings, Position, Watchlist } from '../utils/investing'
import { db } from './config'

export interface InvestingData {
  /** Your symbols and positions; null until you add something. */
  settings: InvestingSettings | null
  summary: HoldingsSummary | null
  watchlist: Watchlist | null
}

/** Your investing data, live (everything here is yours alone; other members have their own). */
export function useInvesting(uid: string): InvestingData {
  const [settings, setSettings] = useState<InvestingSettings | null>(null)
  const [summary, setSummary] = useState<HoldingsSummary | null>(null)
  const [watchlist, setWatchlist] = useState<Watchlist | null>(null)
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'investing', uid),
        (d) => {
          const data = d.data() as Partial<InvestingSettings> | undefined
          setSettings(data ? { symbols: data.symbols ?? [], positions: data.positions ?? [] } : null)
        },
        () => setSettings(null),
      ),
    [uid],
  )
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'investing', uid, 'data', 'summary'),
        (d) => setSummary((d.data() as HoldingsSummary | undefined) ?? null),
        () => setSummary(null),
      ),
    [uid],
  )
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'investing', uid, 'data', 'watchlist'),
        (d) => setWatchlist((d.data() as Watchlist | undefined) ?? null),
        () => setWatchlist(null),
      ),
    [uid],
  )
  return { settings, summary, watchlist }
}

/** Saves your symbols / positions (the scanner picks them up on its next run). */
export const saveInvesting = (uid: string, patch: { symbols?: string[]; positions?: Position[] }) =>
  setDoc(doc(db, 'investing', uid), { ...patch, updatedAt: serverTimestamp() }, { merge: true })

/** Removes your investing data (the settings; the scanner's docs go with the next cleanup). */
export const deleteInvesting = async (uid: string) => {
  await deleteDoc(doc(db, 'investing', uid, 'data', 'summary')).catch(() => undefined)
  await deleteDoc(doc(db, 'investing', uid, 'data', 'watchlist')).catch(() => undefined)
  await deleteDoc(doc(db, 'investing', uid))
}
