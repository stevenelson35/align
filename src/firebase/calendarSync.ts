// "Refresh calendar": asks the Apps Script web app (scripts/apps-script) to sync now instead of waiting for its
// 15-minute trigger. It checks the user's Firebase ID token and household membership itself.
import { auth } from './config'

/** The web app's URL (Deploy → Web app in the Apps Script editor); without it the button isn't shown. */
export const calendarSyncUrl: string | undefined = import.meta.env.VITE_CALENDAR_SYNC_URL || undefined

export interface RefreshResult {
  ok: boolean
  error?: string
  skipped?: boolean
  created?: number
  updated?: number
  removed?: number
}

export async function refreshCalendar(): Promise<RefreshResult> {
  if (!calendarSyncUrl) return { ok: false, error: 'Calendar refresh isn’t set up.' }
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) return { ok: false, error: 'Not signed in.' }
  // text/plain keeps this a "simple" request: Apps Script can't answer a CORS preflight.
  const res = await fetch(calendarSyncUrl, { method: 'POST', body: JSON.stringify({ idToken }) })
  if (!res.ok) return { ok: false, error: `The calendar sync didn’t answer (${res.status}).` }
  return (await res.json()) as RefreshResult
}
