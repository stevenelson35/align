import type { Timestamp } from 'firebase/firestore'

export type Role = 'member' | 'viewer'

export interface HouseholdMember {
  role: Role
  displayName: string
  color: string
  /** The calendar-sync account: a member for the rules, hidden from people pickers. Set in the console. */
  bot?: boolean
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

export type Visibility = 'private' | 'family'
export type Context = 'family' | 'work'

export interface List {
  id: string
  name: string
  kind: 'list' | 'project'
  visibility: Visibility
  ownerId: string
  viewerVisible: boolean
  defaultContext: Context
}

export interface Dependency {
  taskId: string
  offsetDays: number
}

export type Priority = 1 | 2 | 3
export type Status = 'todo' | 'doing' | 'done'

export interface Task {
  id: string
  listId: string
  // Copied from the list (DESIGN.md §5.3).
  visibility: Visibility
  ownerId: string
  viewerVisible: boolean

  title: string
  notes?: string
  priority: Priority
  status: Status
  context: Context
  assigneeId?: string
  for?: string[]

  startDate?: string
  durationDays: number
  targetDate?: string
  dependsOn: Dependency[]
  conflict?: string
  /** Set by the Google Calendar sync; title and dates are overwritten by it (DESIGN.md §5.5). */
  calendar?: { eventId: string; time?: string; location?: string }

  createdBy: string
}

export interface Board {
  id: string
  name: string
  viewerVisible: boolean
}

export type ItemStatus = 'open' | 'chosen' | 'archived'

export interface BoardItem {
  id: string
  boardId: string
  title: string
  category?: string
  status: ItemStatus
  createdBy: string
}

export interface Vote {
  boardId: string
  itemId: string
  uid: string
  tokens: number
}
