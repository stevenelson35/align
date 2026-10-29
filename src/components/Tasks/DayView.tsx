import { Fragment, useState, type FormEvent } from 'react'
import { addDays, formatDay, today } from '../../engine/dates'
import { shiftForward } from '../../engine/scheduling'
import { addTaskNow, inboxFor, updateTask, withStatus } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { Task } from '../../types'
import { dayBuckets, pushToNextDay, relativeDay } from '../../utils/day'
import { people, sortTasks, targetName } from '../../utils/tasks'
import { GoalsStrip } from '../Goals/GoalsStrip'
import { OnThisDay } from '../Photos/OnThisDay'
import { CalendarActions } from './CalendarActions'
import { TaskCard } from './TaskCard'
import { Icon } from '../UI/Icon'
import { parentsOf } from '../../utils/audience'
import { SectionHeader } from '../UI/SectionHeader'
import { ColorKey } from '../UI/ColorKey'
import { HelpTip } from '../UI/HelpTip'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { useStoredSet } from '../../hooks/useStoredSet'
import { splitTitleNote } from '../../utils/quickAdd'
import { TheDaily } from '../Daily/TheDaily'
import { WhoseChips } from '../UI/WhoseChips'
import { useStoredChoice } from '../../hooks/useStoredChoice'
import { WHOSE_VALUES, whoseMatches, type Whose } from '../../utils/whose'
import { ContactsStrip } from '../Contacts/ContactsStrip'
import { FamilyMapStrip } from '../Map/FamilyMapStrip'
import { GiftsStrip } from '../Gifts/GiftsStrip'
import { FlashcardsSection, LinksSection, ListsSection, ProjectsSection } from '../Lists/ListSections'
import { moreOf, TODAY_SECTIONS, type TodaySection } from '../../utils/today'
import { TodayShortcuts } from './TodayShortcuts'
import { ArrangeToday } from './ArrangeToday'

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
  const viewOnlyToday = filtering ? Object.values(dayBuckets(tasks.filter((t) => !app.canEdit(t)), day, now)).flat() : []
  // Everyone else in the household is listed, even with nothing extra today (0), so ticking them is never a mystery.
  const viewOnlyPeople = filtering ? people(app.household, true).map(([id]) => id).filter((id) => id !== app.uid) : []
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

  // Today's sections: on the main page, or folded into More… (your arrangement; Arrange Today at the bottom). Other
  // days show only what belongs to a day (goals, archive pictures, The Daily).
  const more = moreOf(app.member)
  const [moreOpen, setMoreOpen] = useStoredFlag('align-today-more-open', false)
  const sectionFor = (id: TodaySection) => {
    switch (id) {
      case 'goals':
        return <GoalsStrip day={day} />
      case 'map':
        return <FamilyMapStrip />
      case 'contacts':
        return <ContactsStrip />
      case 'gifts':
        return <GiftsStrip />
      case 'lists':
        return <ListsSection />
      case 'links':
        return <LinksSection />
      case 'projects':
        return <ProjectsSection />
      case 'cards':
        return <FlashcardsSection />
      case 'photos':
        return <OnThisDay day={day} />
      case 'daily':
        return <TheDaily day={day} />
    }
  }
  const forThisDay = TODAY_SECTIONS.map((s) => s.id).filter((id) => day === now || id === 'goals' || id === 'photos' || id === 'daily')
  const mainSections = day === now ? forThisDay.filter((id) => !more.has(id)) : forThisDay
  const moreSections = day === now ? forThisDay.filter((id) => more.has(id)) : []

  // The add box opens from "+ Add" (and stays open for several adds).
  const [adding, setAdding] = useState(false)
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
    <section className="day-view">
      <header className="view-header day-header">
        <button type="button" className="secondary small" onClick={() => go(addDays(day, -1))} aria-label="Previous day" title="Previous day">
          ‹
        </button>
        <h2>
          {label || formatDay(day)}
          {label && <span className="muted small day-date"> {formatDay(day)}</span>}
        </h2>
        <HelpTip topic="today" label="Today" />
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

      {day === now && <TodayShortcuts />}
      {mainSections.map((id) => (
        <Fragment key={id}>{sectionFor(id)}</Fragment>
      ))}

      <div className="day-section">
        <SectionHeader
          icon="todo"
          title={day < now ? 'Not Done' : 'To Do'}
          count={b.todo.length}
          help="todo"
          onTitleClick={() => setHide({ ...hide, todo: !hide.todo })}
          expanded={!hide.todo}
          beside={
            <button
              type="button"
              className={`link small key-toggle${showKey ? ' on' : ''}`}
              onClick={() => {
                // Showing the key also opens the To Do list (so the colors have cards to explain); hiding it leaves the list alone.
                if (!showKey && hide.todo) setHide({ ...hide, todo: false })
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
          {hide.todo && b.todo.length > 0 && (
            <button type="button" className="link small" onClick={() => setHide({ ...hide, todo: false })} aria-expanded={false}>
              Show {b.todo.length}
            </button>
          )}
          <button type="button" className="link small" onClick={() => app.navigate({ view: 'home' })} title="Every task, any date (the Tasks page)">
            All tasks
          </button>
          {app.isMember && (
            <button type="button" className="link small" onClick={() => setAdding(!adding)} aria-expanded={adding} title="Add a to do" aria-label="Add a to do">
              <Icon name="plus" /> Add
            </button>
          )}
          {b.todo.length > 0 && day <= now && app.isMember && (
            <button type="button" className="link small" onClick={pushRest} title={`End of day: move what's left to ${day === now ? 'tomorrow' : 'the next day'}`} aria-label="Push the rest">
              <Icon name="skip" /> <span className="hide-mobile">Push rest</span>
            </button>
          )}
        </SectionHeader>
        {/* Picking whose also opens the list: you want to see what the filter shows. */}
        <WhoseChips
          value={todoWhose}
          onChange={(w) => {
            setTodoWhose(w)
            if (hide.todo) setHide({ ...hide, todo: false })
          }}
          label="Whose to-dos"
        />
        {showKey && <ColorKey />}
        {viewOnlyPeople.length > 0 && (
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
        {!hide.todo && b.todo.length === 0 && <p className="muted small">{day < now ? 'Nothing was left undone.' : 'Nothing left to do.'}</p>}
      </div>
      {b.done.length > 0 && (
        <div className="day-section">
          <SectionHeader icon="check" title="Done" count={b.done.length} onTitleClick={() => setHide({ ...hide, done: !hide.done })} expanded={!hide.done} />
          {!hide.done && <div className="task-list">{byDate(b.done).map((t) => card(t))}</div>}
        </div>
      )}
      {b.skipped.length > 0 && (
        <div className="day-section">
          <SectionHeader icon="close" title="Won't Do" count={b.skipped.length} onTitleClick={() => setHide({ ...hide, skipped: !hide.skipped })} expanded={!hide.skipped} />
          {!hide.skipped && <div className="task-list">{byDate(b.skipped).map((t) => card(t))}</div>}
        </div>
      )}
      {b.pushed.length > 0 && (
        <div className="day-section">
          <SectionHeader icon="skip" title="Pushed to a Later Day" count={b.pushed.length} onTitleClick={() => setHide({ ...hide, pushed: !hide.pushed })} expanded={!hide.pushed} />
          {!hide.pushed && <div className="task-list">{byDate(b.pushed).map((t) => card(t, { note: movedTo(t), dayActions: undefined }))}</div>}
        </div>
      )}
      {moreSections.length > 0 && (
        <div className="day-section today-more">
          <SectionHeader icon="list" title="More…" count={moreSections.length} onTitleClick={() => setMoreOpen(!moreOpen)} expanded={moreOpen}>
            <button type="button" className="link small" onClick={() => setMoreOpen(!moreOpen)} aria-expanded={moreOpen}>
              {moreOpen ? 'Hide' : moreSections.map((id) => TODAY_SECTIONS.find((s) => s.id === id)?.label).join(', ')}
            </button>
          </SectionHeader>
          {moreOpen && (
            <div className="today-more-body">
              {moreSections.map((id) => (
                <Fragment key={id}>{sectionFor(id)}</Fragment>
              ))}
            </div>
          )}
        </div>
      )}
      {day === now && app.isMember && <ArrangeToday />}
    </section>
  )
}
