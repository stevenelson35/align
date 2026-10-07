import { createContext } from 'react'
import type { ShiftPreview } from '../engine/scheduling'
import type { Household, HouseholdMember, List, Task } from '../types'
import type { Route } from '../utils/routes'

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
  /** Show a shift preview; nothing is written until the user applies it (DESIGN.md §6.3). */
  proposeShift: (shift: PendingShift) => void
  /** Open the list editor (null = new list). */
  editList: (list: List | null) => void
  // Works for lists too: both carry visibility and ownerId.
  canEdit: (item: Pick<Task, 'visibility' | 'ownerId'>) => boolean
  openChat: (text?: string) => void
}

export const AppContext = createContext<AppState | null>(null)
