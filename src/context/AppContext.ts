import { createContext } from 'react'
import type { ShiftPreview } from '../engine/scheduling'
import type { TaskInput } from '../firebase/db'
import type { Household, HouseholdMember, List } from '../types'
import type { Route } from '../utils/routes'
import type { Shareable } from '../utils/tasks'
import type { DependencyChange } from '../utils/project'

export interface PendingShift {
  title: string
  preview: ShiftPreview
  dependencies?: DependencyChange[]
  /** Other fields written in the same batch (e.g. `pushedFrom` for "⏭ next day"). */
  extra?: { id: string; data: Partial<TaskInput> }[]
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
  /** Opens ⚙ Settings (e.g. from the blog page when the token is missing). */
  openSettings: () => void
  /** Opens the ☰ menu (on a phone), with one section expanded if named (the breadcrumb). */
  openMenu: (section?: string) => void
  textAbout: (taskId: string) => void
  /** The task whose text form should start open, if any. */
  textingId: string | null
  /** Show a shift preview; nothing is written until the user applies it (DESIGN.md §6.3). */
  proposeShift: (shift: PendingShift) => void
  /** Open the list editor (null = new list). */
  /** Edit a list, or (null) make a new one, optionally of a kind (a Today section's + New). */
  editList: (list: List | null, kind?: List['kind']) => void
  // Works for lists too: both carry visibility and ownerId.
  canEdit: (item: Shareable) => boolean
  openChat: (text?: string) => void
}

export const AppContext = createContext<AppState | null>(null)
