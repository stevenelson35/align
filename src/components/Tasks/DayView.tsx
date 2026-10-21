import { useState, type FormEvent } from 'react'
import { addDays, formatDay, today } from '../../engine/dates'
import { shiftForward } from '../../engine/scheduling'
import { addTaskNow, inboxFor, updateTask, withStatus } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { Task } from '../../types'
import { dayBuckets, pushToNextDay, relativeDay } from '../../utils/day'
import { sortTasks } from '../../utils/tasks'
import { GoalsStrip } from '../Goals/GoalsStrip'
import { OnThisDay } from '../Photos/OnThisDay'
import { CalendarActions } from './CalendarActions'
import { TaskCard } from './TaskCard'
import { Icon } from '../UI/Icon'
import { parentsOf } from '../../utils/audience'

/**
 * One day (DESIGN.md §8): today is the start page; ‹ › go to other days. Shows what's left, what got done, what
 * was skipped, and what was pushed on, so yesterday shows what actually happened.
 */
export function DayView({ day }: { day: string }) {
  const app = useApp()
  const { tasks, lists } = useData()
  const now = today()
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const b = dayBuckets(tasks, day, now)
  const byDate = (list: Task[]) => sortTasks(list, 'date')
  const canEditId = (id: string) => {
    const t = tasks.find((x) => x.id === id)
    return !!t && app.canEdit(t)
  }
  const label = relativeDay(day, now)
  const go = (d: string) => app.navigate(d === now ? { view: 'today' } : { view: 'day', day: d })

  /** Returns false when it needs the schedule preview (it moves tasks that depend on it). */
  function push(t: Task, viaPreview = true): boolean {
    const change = pushToNextDay(t, day)
    if (change.startDate) {
      const preview = shiftForward(tasks, { id: t.id, startDate: change.startDate }, canEditId)
      if (preview.moves.length > 1 || preview.blocked.length > 0) {
        if (!viaPreview) return false
        app.proposeShift({ title: `Push ${t.title} to ${formatDay(change.startDate)}`, preview, extra: [{ id: t.id, data: { pushedFrom: change.pushedFrom } }] })
        return true
      }
    }
    updateTask(t.id, change).catch((err) => setError(String(err)))
    return true
  }

  function pushRest() {
    const movable = b.todo.filter((t) => app.canEdit(t) && !t.calendar)
    if (!movable.length || !window.confirm(`Push ${movable.length} unfinished task(s) to ${formatDay(addDays(day, 1))}?`)) return
    const needPreview = movable.filter((t) => !push(t, false))
    setNote(
      needPreview.length
        ? `Pushed ${movable.length - needPreview.length}. ${needPreview.length} have tasks that depend on them; push those one at a time (⏭) to see the schedule change.`
        : `Pushed ${movable.length} to ${formatDay(addDays(day, 1))}.`,
    )
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    const text = title.trim()
    if (!text) return
    setError(null)
    setTitle('') // clear at once, so a second tap can't add it twice
    try {
      const list = await inboxFor(app.uid, app.member.defaultVisibility, lists.filter((l) => app.canEdit(l)), parentsOf(app.household))
      await addTaskNow(list, { title: text, priority: 2, status: 'todo', context: list.defaultContext, durationDays: 1, dependsOn: [], startDate: day }, app.uid).written
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setTitle(text)
    }
  }

  const card = (t: Task, extra: Partial<Parameters<typeof TaskCard>[0]> = {}) => (
    <TaskCard
      key={t.id}
      task={t}
      day={day}
      dayActions={{ push: t.calendar ? undefined : () => push(t), skip: () => updateTask(t.id, withStatus(t, 'canceled', day)).catch((err) => setError(String(err))) }}
      {...extra}
    />
  )
  const movedTo = (t: Task) => {
    const to = t.startDate && t.startDate > day ? t.startDate : t.targetDate
    return to ? `→ moved to ${formatDay(to)}` : undefined
  }

  return (
    <section className="day-view">
      <header className="view-header day-header">
        <button type="button" className="secondary small" onClick={() => go(addDays(day, -1))} aria-label="Previous day" title="Previous day">
          ‹
        </button>
        <h2>
          {label || formatDay(day)}
          {label && <span className="muted small day-date"> {formatDay(day)}</span>}
        </h2>
        <button type="button" className="secondary small" onClick={() => go(addDays(day, 1))} aria-label="Next day" title="Next day">
          ›
        </button>
        {day !== now && (
          <button type="button" className="link small" onClick={() => go(now)}>
            Today
          </button>
        )}
        <span className="grow" />
        {day === now && <CalendarActions />}
      </header>

      <GoalsStrip day={day} />
      <OnThisDay day={day} />

      {app.isMember && (
        <form className="row add-task" onSubmit={add}>
          <input
            placeholder={day === now ? 'Add a task for today…' : `Add a task for ${formatDay(day)}…`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="New task for this day"
          />
          <button type="submit">Add</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      {note && <p className="muted small">{note}</p>}

      <div className="day-section">
        <h3>
          {day < now ? 'Not done' : 'To do'} <span className="muted">{b.todo.length}</span>
          {b.todo.length > 0 && day <= now && app.isMember && (
            <button type="button" className="link small" onClick={pushRest} title="End of day: move what's left to the next day">
              <Icon name="skip" /> Push the rest to {day === now ? 'tomorrow' : 'the next day'}
            </button>
          )}
        </h3>
        <div className="task-list">{byDate(b.todo).map((t) => card(t))}</div>
        {b.todo.length === 0 && <p className="muted small">{day < now ? 'Nothing was left undone.' : 'Nothing left to do.'}</p>}
      </div>
      {b.done.length > 0 && (
        <div className="day-section">
          <h3>
            Done <span className="muted">{b.done.length}</span>
          </h3>
          <div className="task-list">{byDate(b.done).map((t) => card(t))}</div>
        </div>
      )}
      {b.skipped.length > 0 && (
        <div className="day-section">
          <h3>
            Won't do <span className="muted">{b.skipped.length}</span>
          </h3>
          <div className="task-list">{byDate(b.skipped).map((t) => card(t))}</div>
        </div>
      )}
      {b.pushed.length > 0 && (
        <div className="day-section">
          <h3>
            Pushed to a later day <span className="muted">{b.pushed.length}</span>
          </h3>
          <div className="task-list">{byDate(b.pushed).map((t) => card(t, { note: movedTo(t), dayActions: undefined }))}</div>
        </div>
      )}
    </section>
  )
}
