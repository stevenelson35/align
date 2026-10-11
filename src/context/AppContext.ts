import { createContext } from 'react'
import type { ShiftPreview } from '../engine/scheduling'
import type { Household, HouseholdMember, List } from '../types'
import type { Route } from '../utils/routes'
import type { Shareable } from '../utils/tasks'

export interface PendingShift {
  title: string
  preview: ShiftPreview
}

/** UI state shared by the shell, views and chat. */
export interface AppState {
  uid: string
  household: Household
  member: HouseholdMember
  isMember: boolean
  route: Route
  navigate: (route: Route) => void
  selectedTaskId: string | null
  selectTask: (id: string | null) => void
  /** Opens a task / item with its "💬 Text about this" form showing (the 💬 on list rows). */
  textAbout: (taskId: string) => void
  /** The task whose text form should start open, if any. */
  textingId: string | null
  /** Show a shift preview; nothing is written until the user applies it (DESIGN.md §6.3). */
  proposeShift: (shift: PendingShift) => void
  /** Open the list editor (null = new list). */
  editList: (list: List | null) => void
  // Works for lists too: both carry visibility and ownerId.
  canEdit: (item: Shareable) => boolean
  openChat: (text?: string) => void
}

export const AppContext = createContext<AppState | null>(null)
