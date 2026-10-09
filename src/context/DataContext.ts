import { createContext } from 'react'
import type { Board, BoardItem, List, Task, Vote } from '../types'

export interface DataState {
  loaded: boolean
  error: string | null
  lists: List[]
  tasks: Task[]
  boards: Board[]
  /** Items of every visible board. */
  items: BoardItem[]
  /** The signed-in member's votes across all boards (empty for viewers). */
  myVotes: Vote[]
  /** Live conflict reasons by task id (DESIGN.md §6.2). */
  conflicts: Map<string, string>
  taskById: Map<string, Task>
  /** Tasks that list this task id as a prerequisite. */
  dependents: Map<string, Task[]>
}

export const emptyData: DataState = {
  loaded: false,
  error: null,
  lists: [],
  tasks: [],
  boards: [],
  items: [],
  myVotes: [],
  conflicts: new Map(),
  taskById: new Map(),
  dependents: new Map(),
}

export const DataContext = createContext<DataState>(emptyData)
