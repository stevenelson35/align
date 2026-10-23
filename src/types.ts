import type { Timestamp } from 'firebase/firestore'

export type Role = 'member' | 'viewer'

/** A link on an entry's details: `{ url, label? }`, or a bare address (saved before links had names). */
export type StoredLink = string | { url: string; label?: string }

export interface HouseholdMember {
  role: Role
  displayName: string
  color: string
  /** Who can see the lists this person creates, and their quick adds, unless they choose otherwise. Default private. */
  defaultVisibility?: 'private' | 'parents' | 'family' | 'everyone'
  /** Their mobile number, for "text <name> …" (they enter it in Settings). */
  phone?: string
  /**
   * Tasks added without a date (list quick add, chat): due the day they're added so they show on Today (the
   * default), or no date ('none').
   */
  newTaskDue?: 'today' | 'none'
  /** Links (links-list item ids) this person pinned to their own Align menu, in order. */
  pinnedLinks?: string[]
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
  kind: 'list' | 'project' | 'checklist' | 'notes' | 'links' | 'picks' | 'cards' | 'contacts'
  /** Pick lists: what's on it (shows, movies, music…), for its icon and words ("Watched", "Played"). */
  pickKind?: 'shows' | 'movies' | 'theater' | 'music' | 'books' | 'games' | 'other'
  visibility: Visibility
  /** Who can see and edit it when visibility is 'shared' (uids, always including the owner). Tasks copy their list's. */
  sharedWith?: string[]
  ownerId: string
  viewerVisible: boolean
  defaultContext: Context
  /** 'parents' when chosen as Parents (sharedWith holds them), so it shows as Parents rather than Chosen people. */
  audience?: 'parents'
  /**
   * Who can edit it (and its tasks), when narrower than who can see it: Only me / Parents / Chosen people (`editors`)
   * / Family / Everyone. Absent = anyone who can see it may edit (lists made before this). Tasks copy both.
   */
  editAudience?: 'private' | 'parents' | 'family' | 'shared' | 'everyone'
  editors?: string[]
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
  /** Copied from the list: who can edit (absent = whoever can see it). */
  editAudience?: List['editAudience']
  editors?: string[]

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
  /** Contacts: phones, emails, addresses (labeled), company, job title, birthday (utils/contacts.ts). */
  contact?: {
    phones?: { label: 'mobile' | 'home' | 'work' | 'other'; value: string }[]
    emails?: { label: 'mobile' | 'home' | 'work' | 'other'; value: string }[]
    addresses?: { label: 'mobile' | 'home' | 'work' | 'other'; value: string }[]
    org?: string
    jobTitle?: string
    birthday?: string
  }
  /** Flashcards: each person's own results for this card (utils/flashcards.ts CardResult). */
  results?: Record<string, { known?: boolean; right?: number; wrong?: number; last?: string }>
  /** Pick-list items: each person's 1–5 stars (uid → stars), and the days it was watched / played / read. */
  ratings?: Record<string, number>
  watched?: string[]
  /** Extra details, as on every entry: more links and pictures (utils/details.ts). `notes` is the note. */
  links?: StoredLink[]
  images?: string[]
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
  value?: number // progressive: what you did; measure: what you measured; total: amount added that day
  by?: string // who logged it last (shared goals)
  /** Optional details for the day: a note, links, pictures (utils/details.ts; url / imageUrl are the older single ones). */
  note?: string
  links?: StoredLink[]
  images?: string[]
  url?: string
  imageUrl?: string
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
  kind: 'check' | 'tally' | 'progressive' | 'measure' | 'total'
  unit?: string
  perDay?: number
  /** progressive: start at `start` on `from`, add `step` every `every` days or weeks, kept within min..max. */
  progression?: { start: number; step: number; every: number; per: 'day' | 'week'; min?: number; max?: number; from: string }
  /** The goal value. measure: lower or higher is better (`direction`). progressive: the suggestion moves toward it
   *  and stops there. total: the running total to reach. */
  target?: number
  direction?: 'down' | 'up'
  /** Days of the week it applies (0 = Sunday); absent = every day. */
  weekdays?: number[]
  visibility: Visibility
  sharedWith?: string[]
  /** 'parents' when the view audience was chosen as Parents (sharedWith holds them). */
  audience?: 'parents'
  /** Who can log it (utils/audience): the owner only, Parents / Chosen people (`editors`), or every member. */
  editAudience?: 'private' | 'parents' | 'family' | 'shared' | 'everyone'
  editors?: string[]
  ownerId: string
  viewerVisible: boolean
  /** Show a stopwatch on the goal (Use puts its time in the entry box). Number goals only. */
  timer?: boolean
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
  /** Optional details: a note, links and pictures (utils/details.ts; url / imageUrl are the older single ones). */
  note?: string
  links?: StoredLink[]
  images?: string[]
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
