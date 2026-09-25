import type { Timestamp } from 'firebase/firestore'

export type Role = 'member' | 'viewer'

export interface HouseholdMember {
  role: Role
  displayName: string
  color: string
}

export interface Pet {
  id: string
  name: string
  kind: 'dog' | 'cat' | 'bird' | 'fish'
}

export interface Household {
  name: string
  members: Record<string, HouseholdMember>
  pets: Pet[]
  weeklyTokens: number
  tokenStartDate: Timestamp
}
