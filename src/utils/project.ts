import { wouldCreateCycle } from '../engine/graph'
import type { Dependency, Task } from '../types'

export interface DependencyChange {
  id: string
  before: Dependency[]
  after: Dependency[]
}

export function linkProjectTasks(tasks: Task[], listId: string, orderedIds: string[]): DependencyChange[] {
  if (new Set(orderedIds).size !== orderedIds.length) throw new Error('Select each task only once.')
  const byId = new Map(tasks.map((t) => [t.id, { ...t, dependsOn: [...t.dependsOn] }]))
  if (orderedIds.some((id) => byId.get(id)?.listId !== listId)) throw new Error('Choose tasks from this project.')
  const changes: DependencyChange[] = []
  for (let index = 1; index < orderedIds.length; index += 1) {
    const task = byId.get(orderedIds[index])!
    const prerequisite = orderedIds[index - 1]
    if (task.dependsOn.some((d) => d.taskId === prerequisite)) continue
    if (wouldCreateCycle([...byId.values()], task.id, prerequisite)) {
      throw new Error('That order would create a prerequisite loop. Existing prerequisites have been kept.')
    }
    const before = [...task.dependsOn]
    task.dependsOn = [...before, { taskId: prerequisite, offsetDays: 0 }]
    changes.push({ id: task.id, before, after: task.dependsOn })
  }
  return changes
}

export function withDependencyChanges(tasks: Task[], changes: DependencyChange[]): Task[] {
  const byId = new Map(changes.map((change) => [change.id, change.after]))
  return tasks.map((task) => byId.has(task.id) ? { ...task, dependsOn: byId.get(task.id)! } : task)
}