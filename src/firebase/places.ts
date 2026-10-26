// The family map's places (geofences) and each member's alerts: rules, this device's notifications (Firebase Cloud
// Messaging, through the service worker public/sw.js), and email. The Apps Script notices arrivals / departures in
// each OwnTracks report and sends the alerts (scripts/location/README.md).
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import type { AlertPrefs, Place } from '../utils/location'
import { app, db } from './config'

export function usePlaces(): Place[] {
  const [places, setPlaces] = useState<Place[]>([])
  useEffect(
    () =>
      onSnapshot(
        collection(db, 'places'),
        (snap) => setPlaces(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Place, 'id'>) })).sort((a, b) => a.name.localeCompare(b.name))),
        () => setPlaces([]),
      ),
    [],
  )
  return places
}

export function savePlace(place: Omit<Place, 'id'> & { id?: string }, uid: string) {
  const data = { name: place.name.trim().slice(0, 60), lat: place.lat, lon: place.lon, radius: Math.round(place.radius), updatedAt: serverTimestamp() }
  return place.id ? updateDoc(doc(db, 'places', place.id), data) : addDoc(collection(db, 'places'), { ...data, createdBy: uid, createdAt: serverTimestamp() })
}

export const deletePlace = (id: string) => deleteDoc(doc(db, 'places', id))

/** Your own alert settings, live (empty until you set something). */
export function useAlertPrefs(uid: string): AlertPrefs {
  const [prefs, setPrefs] = useState<AlertPrefs>({ rules: [], push: [] })
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'alertPrefs', uid),
        (d) => {
          const data = (d.data() ?? {}) as Partial<AlertPrefs>
          setPrefs({ rules: data.rules ?? [], push: data.push ?? [], email: data.email, emailOn: data.emailOn })
        },
        () => undefined,
      ),
    [uid],
  )
  return prefs
}

export const saveAlertPrefs = (uid: string, patch: Partial<AlertPrefs>) => setDoc(doc(db, 'alertPrefs', uid), { ...patch, updatedAt: serverTimestamp() }, { merge: true })

const VAPID_KEY: string | undefined = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined

/** Why notifications can't be turned on here, or null when they can. */
export async function pushProblem(): Promise<string | null> {
  if (!VAPID_KEY || !import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) return 'Notifications aren’t set up for Align yet (see scripts/location/README.md); email alerts work meanwhile.'
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return 'This browser can’t show notifications.'
  const { isSupported } = await import('firebase/messaging')
  if (!(await isSupported())) {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    return ios && !standalone ? 'On iPhone, first add Align to the Home Screen (Share → Add to Home Screen), open it from there, then turn notifications on.' : 'This browser can’t receive notifications.'
  }
  if (Notification.permission === 'denied') return 'Notifications are blocked for Align in this browser’s settings.'
  return null
}

/** Asks permission, registers the service worker, and adds this device's push token to your alert settings. */
export async function enablePushHere(uid: string, current: string[]): Promise<string> {
  const problem = await pushProblem()
  if (problem) throw new Error(problem)
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications weren’t allowed.')
  const registration = await navigator.serviceWorker.register('./sw.js')
  const { getMessaging, getToken } = await import('firebase/messaging')
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
  if (!token) throw new Error('Couldn’t get a notification address for this device.')
  localStorage.setItem('align-push-token', token)
  await saveAlertPrefs(uid, { push: [...current.filter((t) => t !== token), token].slice(-10) })
  return token
}

/** This device's push token, if notifications were turned on here. */
export const pushTokenHere = () => localStorage.getItem('align-push-token')

/** Stops notifications on this device (removes its token). */
export async function disablePushHere(uid: string, current: string[]) {
  const token = pushTokenHere()
  localStorage.removeItem('align-push-token')
  if (token) {
    try {
      const { deleteToken, getMessaging } = await import('firebase/messaging')
      await deleteToken(getMessaging(app))
    } catch {
      // Already gone; removing it from the settings below is what matters.
    }
  }
  await saveAlertPrefs(uid, { push: current.filter((t) => t !== token) })
}

/** An address → a point, from OpenStreetMap's free geocoder (Nominatim; light use only). */
export async function findAddress(text: string): Promise<{ lat: number; lon: number; label: string } | null> {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(text)}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`The address search didn’t answer (${res.status}).`)
  const [hit] = (await res.json()) as { lat: string; lon: string; display_name: string }[]
  return hit ? { lat: Number(hit.lat), lon: Number(hit.lon), label: hit.display_name } : null
}
