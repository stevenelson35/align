import { doc, onSnapshot, type FirestoreError } from 'firebase/firestore'
import type { Household } from '../types'
import { db } from './config'

export const householdRef = doc(db, 'household', 'main')

export function subscribeHousehold(
  onData: (household: Household) => void,
  onError: (error: FirestoreError) => void,
) {
  return onSnapshot(householdRef, (snap) => onData(snap.data() as Household), onError)
}
