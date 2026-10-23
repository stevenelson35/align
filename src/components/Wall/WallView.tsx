import { useEffect, useState } from 'react'
import { addDays, formatDay, today } from '../../engine/dates'
import { useApp, useData } from '../../hooks/useApp'
import { useFavorites } from '../../hooks/useFavorites'
import { photoCaption, photosForDay, photoUrl } from '../../photos/favorites'
import type { Task } from '../../types'
import { dayBuckets } from '../../utils/day'
import { appliesOn, goalStatus } from '../../utils/goals'
import { isFinished, startMinutes } from '../../utils/tasks'
import { GoalSparkline } from '../Goals/GoalSparkline'
import { Icon } from '../UI/Icon'

/** Calendar events on a day, all-day ones first, then by start time. */
function eventsOn(tasks: Task[], day: string): Task[] {
  return tasks
    .filter((t) => t.calendar && t.startDate && t.startDate <= day && (t.startDate === day || addDays(t.startDate, Math.max(1, t.durationDays) - 1) >= day))
    .sort((a, b) => (startMinutes(a) ?? -1) - (startMinutes(b) ?? -1) || a.title.localeCompare(b.title))
}

/** Keeps the screen on while the wall view is showing (where the browser supports it). */
function useWakeLock() {
  useEffect(() => {
    type Sentinel = { release: () => Promise<void> }
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }
    if (!nav.wakeLock) return
    let lock: Sentinel | null = null
    const take = () => nav.wakeLock!.request('screen').then((l) => (lock = l)).catch(() => undefined)
    void take()
    const again = () => document.visibilityState === 'visible' && void take()
    document.addEventListener('visibilitychange', again)
    return () => {
      document.removeEventListener('visibilitychange', again)
      void lock?.release()
    }
  }, [])
}

/**
 * #/wall: a read-only display for a kitchen screen (an Echo Show's Silk browser, a spare tablet): the time and date,
 * today's calendar, today's to-dos, goals, a family photo that changes every minute, and tomorrow's events. It
 * updates by itself (live data, a clock that rolls over at midnight) and asks the screen to stay on.
 */
export function WallView() {
  const app = useApp()
  const { tasks, goals } = useData()
  const { manifest } = useFavorites()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(t)
  }, [])
  useWakeLock()

  const day = today()
  const tomorrow = addDays(day, 1)
  const events = eventsOn(tasks, day)
  const later = eventsOn(tasks, tomorrow)
  const todos = dayBuckets(tasks, day, day).todo.filter((t) => !t.calendar && app.canEdit(t))
  const dayGoals = goals.filter((g) => appliesOn(g, day))
  const photos = manifest ? photosForDay(manifest.photos, day, 7, 12).photos : []
  const photo = photos.length ? photos[Math.floor(now.getTime() / 60_000) % photos.length] : null
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  return (
    <div className="wall">
      <header className="wall-head">
        <div>
          <div className="wall-time">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
          <div className="wall-date">{now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        </div>
        <button type="button" className="wall-exit" onClick={() => app.navigate({ view: 'today' })} aria-label="Leave the wall display" title="Back to Align">
          <Icon name="close" />
        </button>
      </header>

      <div className="wall-grid">
        <section className="wall-card">
          <h2>
            <Icon name="calendar" /> Today
          </h2>
          {events.length ? (
            <ul className="wall-list">
              {events.map((e) => {
                const start = startMinutes(e)
                return (
                  <li key={e.id} className={start !== undefined && start + 60 < nowMinutes ? 'past' : ''}>
                    <span className="wall-when">{e.calendar?.time?.replace(/–.*/, '') || 'All day'}</span>
                    <span>
                      {e.title}
                      {e.calendar?.location && <span className="wall-sub"> · {e.calendar.location}</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="wall-empty">Nothing on the calendar.</p>
          )}
          {later.length > 0 && (
            <>
              <h3>Tomorrow</h3>
              <ul className="wall-list small">
                {later.slice(0, 5).map((e) => (
                  <li key={e.id}>
                    <span className="wall-when">{e.calendar?.time?.replace(/–.*/, '') || 'All day'}</span>
                    <span>{e.title}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="wall-card">
          <h2>
            <Icon name="todo" /> To Do <span className="wall-count">{todos.length}</span>
          </h2>
          {todos.length ? (
            <ul className="wall-list">
              {todos.slice(0, 12).map((t) => (
                <li key={t.id} className={isFinished(t) ? 'past' : ''}>
                  <span className="wall-box" aria-hidden="true" />
                  <span>
                    {t.title}
                    {t.targetDate && t.targetDate < day && <span className="wall-sub"> · due {formatDay(t.targetDate).replace(/^\w+, /, '')}</span>}
                  </span>
                </li>
              ))}
              {todos.length > 12 && <li className="wall-sub">and {todos.length - 12} more</li>}
            </ul>
          ) : (
            <p className="wall-empty">All done for today.</p>
          )}
        </section>

        <section className="wall-card">
          <h2>
            <Icon name="goal" /> Goals
          </h2>
          {dayGoals.length ? (
            <ul className="wall-list">
              {dayGoals.map((g) => {
                const s = goalStatus(g, g.log?.[day], day)
                return (
                  <li key={g.id}>
                    <span className="grow">{g.name}</span>
                    {s.text && <span className={`goal-status status-${s.state}`}>{s.text}</span>}
                    <GoalSparkline goal={g} />
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="wall-empty">No goals today.</p>
          )}
        </section>

        {photo && (
          <section className="wall-card wall-photo">
            <img src={photoUrl(photo.id, 1024)} alt={photoCaption(photo)} />
            <div className="wall-caption">{photoCaption(photo)}</div>
          </section>
        )}
      </div>
    </div>
  )
}
