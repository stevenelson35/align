import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { clearIndexedDbPersistence, terminate } from 'firebase/firestore'
import { auth, db } from './config'

// No sign-up: accounts are created in the Firebase console (DESIGN.md §2).

export function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

/** Sign out, and remove this device's cached copy of the household's data (a shared phone keeps nothing). */
export async function signOut() {
  await firebaseSignOut(auth)
  try {
    await terminate(db)
    await clearIndexedDbPersistence(db)
  } catch {
    // Another open tab still holds the cache; it's cleared next time. Signing out already worked.
  }
  window.location.reload()
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}
