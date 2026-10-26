// The family map's data: everyone's locations/{uid} (members only, by the rules), your own pause / resume /
// delete, and your personal OwnTracks key from the Apps Script (it signs it; Align can't make one).
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import type { FamilyLocation } from '../utils/location'
import { calendarSyncUrl } from './calendarSync'
import { auth, db } from './config'

/** Everyone's latest positions, live. */
export function useLocations(): { locations: FamilyLocation[]; error: string | null } {
  const [locations, setLocations] = useState<FamilyLocation[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(
    () =>
      onSnapshot(
        collection(db, 'locations'),
        (snap) =>
          setLocations(
            snap.docs.map((d) => {
              const data = d.data() as Partial<FamilyLocation>
              return { ...data, uid: d.id, off: data.off === true }
            }),
          ),
        (err) => setError(err.message),
      ),
    [],
  )
  return { locations, error }
}

/** Pause (off: true) or resume sharing. The Apps Script skips reports while paused; the last point stays. */
export const setSharing = (uid: string, on: boolean) => setDoc(doc(db, 'locations', uid), { off: !on }, { merge: true })

/** Removes your position and trail (a new report from your phone starts it again, unless you pause first). */
export const deleteMyLocation = (uid: string) => deleteDoc(doc(db, 'locations', uid))

/** Your personal key for OwnTracks' address, from the Apps Script (it checks your sign-in and membership). */
export async function getLocationKey(): Promise<{ ok: boolean; key?: string; error?: string }> {
  if (!calendarSyncUrl) return { ok: false, error: 'The Apps Script web app isn’t set up (VITE_CALENDAR_SYNC_URL).' }
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) return { ok: false, error: 'Not signed in.' }
  // text/plain keeps this a "simple" request: Apps Script can't answer a CORS preflight.
  const res = await fetch(calendarSyncUrl, { method: 'POST', body: JSON.stringify({ action: 'locationKey', idToken }) })
  if (!res.ok) return { ok: false, error: `The Apps Script didn’t answer (${res.status}).` }
  return (await res.json()) as { ok: boolean; key?: string; error?: string }
}
