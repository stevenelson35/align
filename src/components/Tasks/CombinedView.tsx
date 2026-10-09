import { useState, type ReactNode } from 'react'
import { useApp, useData } from '../../hooks/useApp'
import type { Context, Priority, Status, Task } from '../../types'
import { filterTasks, people as humans, sortTasks, waitingOn, type SortKey, type TaskFilter } from '../../utils/tasks'
import { TaskCard } from './TaskCard'

interface Props {
  title: string
  tasks: Task[]
  defaultSort?: SortKey
  /** Extra buttons for the header (e.g. Today's "Refresh calendar"). */
  actions?: ReactNode
}

/** Combined view (DESIGN.md §8): color-coded, with filters and sorting. */
export function CombinedView({ title, tasks, defaultSort = 'date', actions }: Props) {
  const { household } = useApp()
  const { lists, taskById } = useData()
  const [filter, setFilter] = useState<TaskFilter>({ status: 'open' })
  const [sort, setSort] = useState<SortKey>(defaultSort)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [readyOnly, setReadyOnly] = useState(false)
  // A task you tick off here stays in view (grayed) until you leave the view, so a mis-click can be unticked.
  const [tickedHere, setTickedHere] = useState<ReadonlySet<string>>(new Set())
  const justDone =
    filter.status === 'open'
      ? filterTasks(
          tasks.filter((t) => t.status === 'done' && tickedHere.has(t.id)),
          { ...filter, status: undefined },
        )
      : []
  const shown = sortTasks(
    [...filterTasks(tasks, filter), ...justDone].filter((t) => !readyOnly || waitingOn(t, taskById).length === 0),
    sort,
  )
  const onTicked = (id: string) => setTickedHere((s) => new Set(s).add(id))

  const set = (patch: Partial<TaskFilter>) => setFilter((f) => ({ ...f, ...patch }))
  const people = humans(household).map(([id, m]) => ({ id, name: m.displayName }))
  const targets = [...people, ...household.pets.map((p) => ({ id: p.id, name: p.name }))]

  return (
    <section>
      <header className="view-header">
        <h2>{title}</h2>
        <span className="muted">{shown.length} tasks</span>
        <span className="grow" />
        {actions}
        <button type="button" className="secondary small show-mobile" onClick={() => setFiltersOpen((o) => !o)}>
          Filters
        </button>
      </header>
      <div className={`filters${filtersOpen ? ' open' : ''}`}>
        <select value={filter.listId ?? ''} onChange={(e) => set({ listId: e.target.value || undefined })}>
          <option value="">All lists</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <select value={filter.context ?? ''} onChange={(e) => set({ context: (e.target.value || undefined) as Context | undefined })}>
          <option value="">Family & work</option>
          <option value="family">Family</option>
          <option value="work">Work</option>
        </select>
        <select value={filter.forId ?? ''} onChange={(e) => set({ forId: e.target.value || undefined })}>
          <option value="">For anyone</option>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              For {t.name}
            </option>
          ))}
        </select>
        <select value={filter.assigneeId ?? ''} onChange={(e) => set({ assigneeId: e.target.value || undefined })}>
          <option value="">Any assignee</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={filter.priority ?? ''}
          onChange={(e) => set({ priority: e.target.value ? (Number(e.target.value) as Priority) : undefined })}
        >
          <option value="">Any priority</option>
          <option value="1">High</option>
          <option value="2">Medium</option>
          <option value="3">Low</option>
        </select>
        <select value={filter.status ?? ''} onChange={(e) => set({ status: (e.target.value || undefined) as Status | 'open' | undefined })}>
          <option value="open">Not done</option>
          <option value="">Any status</option>
          <option value="todo">To do</option>
          <option value="doing">Doing</option>
          <option value="done">Done</option>
          <option value="canceled">Canceled</option>
        </select>
        <label className="inline">
          From
          <input type="date" value={filter.from ?? ''} onChange={(e) => set({ from: e.target.value || undefined })} />
        </label>
        <label className="inline">
          To
          <input type="date" value={filter.to ?? ''} onChange={(e) => set({ to: e.target.value || undefined })} />
        </label>
        <label className="inline" title="Hide tasks still waiting on an unfinished prerequisite">
          <input type="checkbox" checked={readyOnly} onChange={(e) => setReadyOnly(e.target.checked)} />
          Ready to do only
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
          <option value="date">Sort by date</option>
          <option value="priority">Sort by priority</option>
          <option value="dependency">Dependency order</option>
        </select>
      </div>
      <div className="task-list">
        {shown.map((t) => (
          <TaskCard key={t.id} task={t} onTicked={onTicked} />
        ))}
        {shown.length === 0 && <p className="muted">Nothing here.</p>}
      </div>
    </section>
  )
}
