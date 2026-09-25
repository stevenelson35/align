import type { User } from 'firebase/auth'
import { createContext } from 'react'
import type { Household, HouseholdMember } from '../types'

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'unauthorized'; user: User }
  | { status: 'error'; message: string }
  | { status: 'ready'; user: User; household: Household; member: HouseholdMember }

export const SessionContext = createContext<SessionState>({ status: 'loading' })
