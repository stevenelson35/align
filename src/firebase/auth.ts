import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updatePassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { clearIndexedDbPersistence, terminate } from 'firebase/firestore'
import { auth, db } from './config'

// No sign-up: accounts are created in the Firebase console (DESIGN.md §2).

export function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

/**
 * "Forgot password?": Firebase emails a link to its own page for choosing a new password (free on the Spark plan;
 * the email's wording is in the Firebase console → Authentication → Templates). The caller says the same thing
 * whether or not the address has an account, so the form can't be used to find out who has one.
 */
export function sendPasswordReset(email: string) {
  return sendPasswordResetEmail(auth, email.trim())
}

/**
 * Change your password from Settings. Firebase wants a recent sign-in for this, so the current password is checked
 * first (that also stops someone using a phone left signed in from changing it).
 */
export async function changePassword(current: string, next: string) {
  const user = auth.currentUser
  if (!user?.email) throw new Error('Sign in again first.')
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current))
  } catch {
    throw new Error('Your current password isn’t right.')
  }
  await updatePassword(user, next)
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
