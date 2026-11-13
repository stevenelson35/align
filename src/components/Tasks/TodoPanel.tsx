import { useState, type FormEvent } from 'react'
import { addDays, formatDay, today } from '../../engine/dates'
import { shiftForward } from '../../engine/scheduling'
import { addTaskNow, inboxFor, updateTask, withStatus } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { Task } from '../../types'
import { dayBuckets, pushToNextDay } from '../../utils/day'
import { people, sortTasks, targetName } from '../../utils/tasks'
import { TaskCard } from './TaskCard'
import { Icon } from '../UI/Icon'
import { parentsOf } from '../../utils/audience'
import { SectionHeader } from '../UI/SectionHeader'
import { ColorKey } from '../UI/ColorKey'
import { HelpTip } from '../UI/HelpTip'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { useStoredSet } from '../../hooks/useStoredSet'
import { splitTitleNote } from '../../utils/quickAdd'
import { WhoseChips } from '../UI/WhoseChips'
import { useStoredChoice } from '../../hooks/useStoredChoice'
import { WHOSE, WHOSE_VALUES, whoseMatches, type Whose } from '../../utils/whose'
import { useTodaySelect } from '../../hooks/useTodaySection'

/**
 * To Do for one day (a Today tile): what's left, then what got done, what was skipped and what was pushed on, so
 * yesterday shows what actually happened.
 */
export function TodoPanel({ day }: { day: string }) {
  const app = useApp()
  const { tasks, lists } = useData()
  const now = today()
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  // Today shows what you can change (yours and the family's). Tasks you can only view (a list whose owner kept
  // editing to themselves) are added per person with the "Also show" chips, remembered on this device. View-only
  // accounts see everything they can, as before.
  const [also, toggleAlso] = useStoredSet('align-today-also')
  // Tap a section's title to fold it away (To do, Done, Won't do, Pushed); remembered on this device.
  const [hide, setHideState] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('align-day-hidden') ?? '{}') as Record<string, boolean>
    } catch {
      return {}
    }
  })
  const setHide = (next: Record<string, boolean>) => {
    localStorage.setItem('align-day-hidden', JSON.stringify(next))
    setHideState(next)
  }
  const whose = (t: Task) => t.assigneeId ?? t.ownerId
  const filtering = app.member.role === 'member'
  const shown = (t: Task) => !filtering || app.canEdit(t) || also.has('everyone') || also.has(whose(t))
  // The same All / Mine / Family / Shared as the Tasks page (remembered on this device).
  const [todoWhose, setTodoWhose] = useStoredChoice<Whose>('align-todo-whose', WHOSE_VALUES, 'all')
  const b = dayBuckets(tasks.filter(shown).filter((t) => whoseMatches(t, todoWhose, app.uid)), day, now)
  const allToday = todoWhose === 'all' ? b.todo.length : dayBuckets(tasks.filter(shown), day, now).todo.length
  const viewOnlyToday = filtering ? Object.values(dayBuckets(tasks.filter((t) => !app.canEdit(t)), day, now)).flat() : []
  // Everyone else in the household is listed, even with nothing extra today (0), so ticking them is never a mystery.
  const viewOnlyPeople = filtering ? people(app.household, true).map(([id]) => id).filter((id) => id !== app.uid) : []
  const byDate = (list: Task[]) => sortTasks(list, 'date')
  const canEditId = (id: string) => {
    const t = tasks.find((x) => x.id === id)
    return !!t && app.canEdit(t)
  }

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

  // The add box opens from "+" (and stays open for several adds).
  const [adding, setAdding] = useState(false)
  const selectTodo = useTodaySelect(() => {
    setHide({ ...hide, todo: true, done: true, skipped: true, pushed: true })
    setAdding(false)
  }, 'tasks')
  const toggleTasks = (id: string, hidden: boolean) => {
    if (!hidden) selectTodo()
    setHide(hidden ? { ...hide, [id]: true } : { todo: true, done: true, skipped: true, pushed: true, [id]: false })
  }
  // The color key starts shown; hiding (or showing) it is remembered on this device.
  const [showKey, setShowKey] = useStoredFlag('align-color-key-shown', true)

  async function add(e: FormEvent) {
    e.preventDefault()
    const text = title.trim()
    if (!text) return
    setError(null)
    setTitle('') // clear at once, so a second tap can't add it twice
    try {
      const list = await inboxFor(app.uid, app.member.defaultVisibility, lists.filter((l) => app.canEdit(l)), parentsOf(app.household))
      await addTaskNow(list, { ...splitTitleNote(text), priority: 2, status: 'todo', context: list.defaultContext, durationDays: 1, dependsOn: [], startDate: day }, app.uid).written
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
    <>
      <div className="day-section">
        <SectionHeader
          icon="todo"
          title={day < now ? 'Not Done' : 'To Do'}
          count={b.todo.length}
          help="todo"
          onTitleClick={() => toggleTasks('todo', !hide.todo)}
          expanded={!hide.todo}
          beside={
            <button
              type="button"
              className={`link small key-toggle${showKey ? ' on' : ''}`}
              onClick={() => {
                // Showing the key also opens the To Do list (so the colors have cards to explain); hiding it leaves the list alone.
                if (!showKey) toggleTasks('todo', false)
                setShowKey(!showKey)
              }}
              aria-expanded={showKey}
              aria-label="What the colors mean"
              title="What the colors mean"
            >
              <Icon name="swatch" />
            </button>
          }
        >
          {hide.todo && (
            <button type="button" className="link small" onClick={() => toggleTasks('todo', false)} aria-expanded={false}>
              {b.todo.length ? `Show ${b.todo.length}` : 'Show'}
            </button>
          )}
          <button type="button" className="link small" onClick={() => app.navigate({ view: 'home' })} title="Every task, any date (the Tasks page)">
            All tasks
          </button>
          {app.isMember && (
            <button type="button" className="link small header-add" onClick={() => { if (!adding) toggleTasks('todo', false); setAdding(!adding) }} aria-expanded={adding} title="Add a to do" aria-label="Add a to do">
              <Icon name="plus" />
            </button>
          )}
          {b.todo.length > 0 && day <= now && app.isMember && (
            <button type="button" className="link small" onClick={pushRest} title={`End of day: move what's left to ${day === now ? 'tomorrow' : 'the next day'}`} aria-label="Push the rest">
              <Icon name="skip" /> <span className="hide-mobile">Push rest</span>
            </button>
          )}
        </SectionHeader>
        {/* Folded, To Do is just its header (with Show); open, its filters, key and tasks. */}
        {!hide.todo && <WhoseChips value={todoWhose} onChange={(value) => { selectTodo(); setTodoWhose(value) }} label="Whose to-dos" />}
        {!hide.todo && showKey && <ColorKey />}
        {!hide.todo && viewOnlyPeople.length > 0 && (
          <div className="also-show small" role="group" aria-label="Also show tasks you can only view">
            <span className="muted">Also show:</span>
            {viewOnlyPeople.map((id) => (
              <label key={id} className={`chip-toggle${also.has(id) || also.has('everyone') ? ' on' : ''}`}>
                <input type="checkbox" checked={also.has(id) || also.has('everyone')} disabled={also.has('everyone')} onChange={() => toggleAlso(id)} />
                {targetName(id, app.household)} ({viewOnlyToday.filter((t) => whose(t) === id).length})
              </label>
            ))}
            <label className={`chip-toggle${also.has('everyone') ? ' on' : ''}`}>
              <input type="checkbox" checked={also.has('everyone')} onChange={() => toggleAlso('everyone')} />
              Everyone ({viewOnlyToday.length})
            </label>
            <HelpTip topic="todo" label="Also show" />
          </div>
        )}
        {app.isMember && adding && (
          <form className="row add-task" onSubmit={add}>
            <input
              autoFocus
              placeholder={day === now ? 'Add a task for today… (title: note)' : `Add a task for ${formatDay(day)}… (title: note)`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
              aria-label="New task for this day"
            />
            <button type="submit" className="icon-button" aria-label="Add" title="Add" disabled={!title.trim()}>
              <Icon name="plus" />
            </button>
          </form>
        )}
        {error && <p className="error">{error}</p>}
        {note && <p className="muted small">{note}</p>}
        {!hide.todo && <div className="task-list">{byDate(b.todo).map((t) => card(t))}</div>}
        {!hide.todo && b.todo.length === 0 && todoWhose !== 'all' && allToday > 0 && (
          <p className="muted small">
            Nothing for {WHOSE.find((w) => w.value === todoWhose)?.label} {day === now ? 'today' : 'that day'}.{' '}
            <button type="button" className="link small" onClick={() => setTodoWhose('all')}>
              All has {allToday}
            </button>
          </p>
        )}
        {!hide.todo && b.todo.length === 0 && (todoWhose === 'all' || allToday === 0) && <p className="muted small">{day < now ? 'Nothing was left undone.' : 'Nothing left to do.'}</p>}
      </div>
      {b.done.length > 0 && (
        <div className="day-section">
          <SectionHeader icon="check" title="Done" count={b.done.length} onTitleClick={() => toggleTasks('done', !hide.done)} expanded={!hide.done} />
          {!hide.done && <div className="task-list">{byDate(b.done).map((t) => card(t))}</div>}
        </div>
      )}
      {b.skipped.length > 0 && (
        <div className="day-section">
          <SectionHeader icon="close" title="Won't Do" count={b.skipped.length} onTitleClick={() => toggleTasks('skipped', !hide.skipped)} expanded={!hide.skipped} />
          {!hide.skipped && <div className="task-list">{byDate(b.skipped).map((t) => card(t))}</div>}
        </div>
      )}
      {b.pushed.length > 0 && (
        <div className="day-section">
          <SectionHeader icon="skip" title="Pushed to a Later Day" count={b.pushed.length} onTitleClick={() => toggleTasks('pushed', !hide.pushed)} expanded={!hide.pushed} />
          {!hide.pushed && <div className="task-list">{byDate(b.pushed).map((t) => card(t, { note: movedTo(t), dayActions: undefined }))}</div>}
        </div>
      )}
    </>
  )
}
