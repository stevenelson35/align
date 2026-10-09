import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { conflictsById } from '../engine/scheduling'
import { subscribeBoards, subscribeItems, subscribeLists, subscribeMyVotes, subscribeTasks } from '../firebase/db'
import type { Board, BoardItem, List, Role, Task, Vote } from '../types'
import { isFinished, isItemList } from '../utils/tasks'
import { DataContext, type DataState } from './DataContext'

/** Real-time subscriptions to everything the signed-in user can read. Household scale, so it's all in memory. */
export function DataProvider({ uid, role, children }: { uid: string; role: Role; children: ReactNode }) {
  const [lists, setLists] = useState<List[] | null>(null)
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [boards, setBoards] = useState<Board[] | null>(null)
  const [itemsByBoard, setItemsByBoard] = useState<Record<string, BoardItem[]>>({})
  const [myVotes, setMyVotes] = useState<Vote[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onError = (e: Error) => setError(e.message)
    const unsubs = [
      subscribeLists(uid, role, setLists, onError),
      subscribeTasks(uid, role, setTasks, onError),
      subscribeBoards(role, setBoards, onError),
    ]
    if (role === 'member') unsubs.push(subscribeMyVotes(uid, setMyVotes, onError))
    return () => unsubs.forEach((u) => u())
  }, [uid, role])

  const boardIds = (boards ?? []).map((b) => b.id).sort().join(',')
  useEffect(() => {
    if (!boardIds) return
    const unsubs = boardIds.split(',').map((id) =>
      subscribeItems(id, (items) => setItemsByBoard((prev) => ({ ...prev, [id]: items })), (e) => setError(e.message)),
    )
    return () => unsubs.forEach((u) => u())
  }, [boardIds])

  const value = useMemo<DataState>(() => {
    // Checklist items and notes live in the tasks collection (same rules) but aren't tasks.
    const itemListIds = new Set((lists ?? []).filter(isItemList).map((l) => l.id))
    const allTasks = (tasks ?? []).filter((t) => !itemListIds.has(t.listId))
    const listItems = (tasks ?? []).filter((t) => itemListIds.has(t.listId))
    const liveBoards = new Set((boards ?? []).map((b) => b.id))
    // Finished tasks still constrain their dependents, but aren't flagged themselves.
    const conflicts = conflictsById(allTasks)
    for (const t of allTasks) if (isFinished(t)) conflicts.delete(t.id)
    const dependents = new Map<string, Task[]>()
    for (const t of allTasks) for (const d of t.dependsOn) dependents.set(d.taskId, [...(dependents.get(d.taskId) ?? []), t])
    return {
      loaded: lists !== null && tasks !== null && boards !== null,
      error,
      lists: [...(lists ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
      tasks: allTasks,
      listItems,
      boards: [...(boards ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
      items: Object.entries(itemsByBoard)
        .filter(([id]) => liveBoards.has(id))
        .flatMap(([, items]) => items),
      myVotes,
      conflicts,
      taskById: new Map(allTasks.map((t) => [t.id, t])),
      dependents,
    }
  }, [lists, tasks, boards, itemsByBoard, myVotes, error])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
