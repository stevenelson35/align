import { useState, type PointerEvent } from 'react'
import { addDays, diffDays, formatDay, today } from '../../engine/dates'
import { topoSort } from '../../engine/graph'
import { finish, shiftForward } from '../../engine/scheduling'
import { useApp, useData } from '../../hooks/useApp'
import type { List, Task } from '../../types'
import { colorKey } from '../../utils/tasks'

const DAY = 28
const ROW = 34
const LABEL = 180
const HEAD = 28

/** Project timeline (DESIGN.md §6.4): bars, dependency arrows with offsets, drag a bar to preview a forward shift. */
export function TimelineView({ list }: { list: List }) {
  const app = useApp()
  const { tasks, conflicts } = useData()
  const [drag, setDrag] = useState<{ id: string; startX: number; dx: number } | null>(null)

  const listTasks = topoSort(tasks.filter((t) => t.listId === list.id))
  const scheduled = listTasks.filter((t) => t.startDate)
  const unscheduled = listTasks.filter((t) => !t.startDate)
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const canEditId = (id: string) => {
    const t = byId.get(id)
    return !!t && app.canEdit(t)
  }

  const header = (
    <header className="view-header">
      <h2>{list.name}: timeline</h2>
      <span className="grow" />
      <button type="button" className="secondary small" onClick={() => app.navigate({ view: 'list', listId: list.id, timeline: false })}>
        List
      </button>
    </header>
  )

  if (scheduled.length === 0) {
    return (
      <section>
        {header}
        <p className="muted">No tasks have a start date yet. Give tasks a start date to see them here.</p>
      </section>
    )
  }

  const days = scheduled.flatMap((t) => [t.startDate!, finish(t)!, ...(t.targetDate ? [t.targetDate] : [])])
  const first = addDays(days.reduce((a, b) => (a < b ? a : b)), -2)
  const last = addDays(days.reduce((a, b) => (a > b ? a : b)), 3)
  const span = diffDays(first, last) + 1
  const width = LABEL + span * DAY
  const height = HEAD + scheduled.length * ROW + 8
  const rowOf = new Map(scheduled.map((t, i) => [t.id, i]))
  const xOf = (day: string) => LABEL + diffDays(first, day) * DAY
  const dragDays = (t: Task) => (drag?.id === t.id ? Math.round(drag.dx / DAY) : 0)

  function onPointerDown(e: PointerEvent, t: Task) {
    if (!app.canEdit(t)) return
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setDrag({ id: t.id, startX: e.clientX, dx: 0 })
  }

  function onPointerUp(t: Task) {
    const moved = dragDays(t)
    setDrag(null)
    if (moved === 0) {
      app.selectTask(t.id)
      return
    }
    const to = addDays(t.startDate!, moved)
    app.proposeShift({ title: `Move ${t.title} to ${formatDay(to)}`, preview: shiftForward(tasks, { id: t.id, startDate: to }, canEditId) })
  }

  const todayDay = today()

  return (
    <section>
      {header}
      <p className="muted small">Drag a bar to move it; dependent tasks are previewed before anything changes. Click a bar to edit.</p>
      <div className="timeline-scroll">
        <svg width={width} height={height} className="timeline">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted)" />
            </marker>
          </defs>
          {Array.from({ length: span }, (_, i) => {
            const day = addDays(first, i)
            const weekend = [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay())
            return (
              <g key={day}>
                {weekend && <rect x={LABEL + i * DAY} y={HEAD} width={DAY} height={height - HEAD} fill="var(--bg)" />}
                {(i === 0 || day.endsWith('-01') || new Date(`${day}T00:00:00Z`).getUTCDay() === 1) && (
                  <text x={LABEL + i * DAY + 2} y={18} className="tl-day">
                    {formatDay(day)}
                  </text>
                )}
              </g>
            )
          })}
          {todayDay >= first && todayDay <= last && (
            <line x1={xOf(todayDay)} x2={xOf(todayDay)} y1={HEAD} y2={height} stroke="var(--danger)" strokeDasharray="3 3" />
          )}

          {scheduled.map((t) =>
            t.dependsOn
              .filter((d) => rowOf.has(d.taskId))
              .map((d) => {
                const a = byId.get(d.taskId)!
                const x1 = xOf(addDays(finish(a)!, 1)) + dragDays(a) * DAY
                const y1 = HEAD + rowOf.get(a.id)! * ROW + ROW / 2
                const x2 = xOf(t.startDate!) + dragDays(t) * DAY
                const y2 = HEAD + rowOf.get(t.id)! * ROW + ROW / 2
                const mx = Math.max(x1 + 6, x2 - 10)
                return (
                  <g key={`${a.id}-${t.id}`}>
                    <path d={`M ${x1} ${y1} H ${mx} V ${y2} H ${x2}`} fill="none" stroke="var(--muted)" markerEnd="url(#arrow)" />
                    {d.offsetDays > 0 && (
                      <text x={mx + 3} y={(y1 + y2) / 2} className="tl-offset">
                        +{d.offsetDays}d
                      </text>
                    )}
                  </g>
                )
              }),
          )}

          {scheduled.map((t, i) => {
            const y = HEAD + i * ROW
            const x = xOf(t.startDate!) + dragDays(t) * DAY
            const conflict = conflicts.get(t.id)
            return (
              <g key={t.id}>
                <text x={8} y={y + ROW / 2 + 4} className="tl-label">
                  {t.title.length > 24 ? `${t.title.slice(0, 23)}…` : t.title}
                </text>
                {t.targetDate && (
                  <line x1={xOf(addDays(t.targetDate, 1))} x2={xOf(addDays(t.targetDate, 1))} y1={y + 4} y2={y + ROW - 4} stroke="var(--text)" strokeWidth={2} />
                )}
                <rect
                  x={x}
                  y={y + 6}
                  width={t.durationDays * DAY - 2}
                  height={ROW - 12}
                  rx={4}
                  className={`tl-bar color-${colorKey(t, list)}${conflict ? ' conflict' : ''}${app.canEdit(t) ? ' draggable' : ''}`}
                  onPointerDown={(e) => onPointerDown(e, t)}
                  onPointerMove={(e) => drag?.id === t.id && setDrag({ ...drag, dx: e.clientX - drag.startX })}
                  onPointerUp={() => onPointerUp(t)}
                  onClick={() => !app.canEdit(t) && app.selectTask(t.id)}
                >
                  <title>{conflict ? `${t.title}: ${conflict}` : t.title}</title>
                </rect>
              </g>
            )
          })}
        </svg>
      </div>
      {unscheduled.length > 0 && (
        <p className="muted small">
          Not scheduled:{' '}
          {unscheduled.map((t, i) => (
            <span key={t.id}>
              {i > 0 && ', '}
              <button type="button" className="link inline-link" onClick={() => app.selectTask(t.id)}>
                {t.title}
              </button>
            </span>
          ))}
        </p>
      )}
    </section>
  )
}
