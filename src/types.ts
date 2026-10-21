import type { Timestamp } from 'firebase/firestore'

export type Role = 'member' | 'viewer'

export interface HouseholdMember {
  role: Role
  displayName: string
  color: string
  /** Who can see the lists this person creates, and their quick adds, unless they choose otherwise. Default private. */
  defaultVisibility?: Visibility
  /** Their mobile number, for "text <name> …" (they enter it in Settings). */
  phone?: string
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
  /** Named groups for the sharing shortcuts (e.g. "Parents"). A convenience only: access is each list's sharedWith. */
  groups?: { parents?: string[] }
}

/** private: the owner. family: every member (viewers too if viewerVisible). shared: the people in sharedWith. */
export type Visibility = 'private' | 'family' | 'shared'
export type Context = 'family' | 'work'

export interface List {
  id: string
  name: string
  /**
   * list / project: tasks (projects add dependencies and the timeline). checklist: things to tick off that aren't
   * tasks (shopping, gifts, people to call). notes: reference info. Checklist items and notes are stored like tasks
   * (same collection and rules) but stay out of the task views.
   */
  kind: 'list' | 'project' | 'checklist' | 'notes' | 'links'
  visibility: Visibility
  /** Who can see and edit it when visibility is 'shared' (uids, always including the owner). Tasks copy their list's. */
  sharedWith?: string[]
  ownerId: string
  viewerVisible: boolean
  defaultContext: Context
}

export interface Dependency {
  taskId: string
  offsetDays: number
}

export type Priority = 1 | 2 | 3
/** Done and canceled are both finished: off the to-do views, and they no longer hold up dependents. */
export type Status = 'todo' | 'doing' | 'done' | 'canceled'

export interface Task {
  id: string
  listId: string
  // Copied from the list (DESIGN.md §5.3).
  visibility: Visibility
  /** Who can see and edit it when visibility is 'shared' (uids, always including the owner). Tasks copy their list's. */
  sharedWith?: string[]
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
  /** The day ('YYYY-MM-DD') it became done or canceled; cleared if reopened. Places it on that day's view. */
  finishedOn?: string
  /** Links lists: the address it opens, and its category ("Home/Utilities" nests). */
  url?: string
  category?: string
  /** A reading-list task: the link it's about ("Read: …"); the link shows 📖 until this task is done. */
  linkId?: string
  /** Days it was pushed off ("⏭ next day"), so a past day can show what was rescheduled. */
  pushedFrom?: string[]
  /** Set by the Google Calendar sync; title and dates are overwritten by it (DESIGN.md §5.5). */
  calendar?: { eventId: string; time?: string; location?: string; /** The event's page in Google Calendar. */ link?: string }

  createdBy: string
  /** Firestore timestamp; null until the server confirms a new doc. Orders checklist items as added. */
  createdAt?: { seconds: number; nanoseconds: number } | null
}

/** One day's entry on a goal. */
export interface GoalEntry {
  done?: boolean // check
  count?: number // tally: how many times today
  value?: number // progressive: what you did; measure: what you measured
  by?: string // who logged it last (shared goals)
}

/**
 * A daily goal (DESIGN.md §5.6): shown on each day it applies to, logged per day, charted over time. Not a task.
 * check: done or not ("walk dogs"). tally: tap once each time, up to perDay ("12 oz water × 8"). progressive: a
 * suggested amount that grows on a schedule, and what you did ("push-ups, suggested 10"). measure: a target and
 * what you measured ("weight").
 */
export interface Goal {
  id: string
  name: string
  kind: 'check' | 'tally' | 'progressive' | 'measure'
  unit?: string
  perDay?: number
  /** progressive: start at `start` on `from`, add `step` every `every` days or weeks, kept within min..max. */
  progression?: { start: number; step: number; every: number; per: 'day' | 'week'; min?: number; max?: number; from: string }
  /** measure: the goal value, and whether lower or higher is better. */
  target?: number
  direction?: 'down' | 'up'
  /** Days of the week it applies (0 = Sunday); absent = every day. */
  weekdays?: number[]
  visibility: Visibility
  sharedWith?: string[]
  ownerId: string
  viewerVisible: boolean
  log?: Record<string, GoalEntry>
  archived?: boolean
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
  /** Optional details: a note, a link, and a picture (an image address, e.g. uploaded through Cloudinary). */
  note?: string
  url?: string
  imageUrl?: string
  createdBy: string
}

/** A comment on a board or on one of its items. */
export interface Comment {
  id: string
  text: string
  uid: string
  /** Firestore timestamp; null until the server confirms a new comment. */
  createdAt?: { seconds: number; nanoseconds: number } | null
  edited?: boolean
}

export interface Vote {
  boardId: string
  itemId: string
  uid: string
  tokens: number
}
