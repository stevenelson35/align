// The task dependency DAG (DESIGN.md §6). Edges live only in each task's dependsOn.

export interface Node {
  id: string
  dependsOn: { taskId: string }[]
}

/** Would making `taskId` depend on `prereqId` create a cycle? True if prereqId already (transitively) depends on taskId. */
export function wouldCreateCycle(nodes: Node[], taskId: string, prereqId: string): boolean {
  if (taskId === prereqId) return true
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const seen = new Set<string>()
  const stack = [prereqId]
  while (stack.length) {
    const id = stack.pop()!
    if (id === taskId) return true
    if (seen.has(id)) continue
    seen.add(id)
    for (const dep of byId.get(id)?.dependsOn ?? []) stack.push(dep.taskId)
  }
  return false
}

/** Prerequisites before dependents. Edges to tasks outside `nodes` are ignored; any cycle members go last in input order. */
export function topoSort<T extends Node>(nodes: T[]): T[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const indegree = new Map(nodes.map((n) => [n.id, 0]))
  const dependents = new Map<string, string[]>()
  for (const n of nodes) {
    for (const dep of n.dependsOn) {
      if (!byId.has(dep.taskId)) continue
      indegree.set(n.id, indegree.get(n.id)! + 1)
      dependents.set(dep.taskId, [...(dependents.get(dep.taskId) ?? []), n.id])
    }
  }
  const queue = nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id)
  const out: T[] = []
  while (queue.length) {
    const id = queue.shift()!
    out.push(byId.get(id)!)
    for (const next of dependents.get(id) ?? []) {
      indegree.set(next, indegree.get(next)! - 1)
      if (indegree.get(next) === 0) queue.push(next)
    }
  }
  const placed = new Set(out.map((n) => n.id))
  return [...out, ...nodes.filter((n) => !placed.has(n.id))]
}

/** Every task that (transitively) depends on any of `ids`, not including `ids` themselves. */
export function descendants(nodes: Node[], ids: Iterable<string>): Set<string> {
  const dependents = new Map<string, string[]>()
  for (const n of nodes) {
    for (const dep of n.dependsOn) dependents.set(dep.taskId, [...(dependents.get(dep.taskId) ?? []), n.id])
  }
  const start = new Set(ids)
  const out = new Set<string>()
  const stack = [...start]
  while (stack.length) {
    for (const next of dependents.get(stack.pop()!) ?? []) {
      if (!out.has(next) && !start.has(next)) {
        out.add(next)
        stack.push(next)
      }
    }
  }
  return out
}
