import { formatDay } from '../../engine/dates'
import { finish } from '../../engine/scheduling'
import { updateTask } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { Task } from '../../types'
import { colorKey, isFinished, PRIORITY_LABEL, STATUS_LABEL, targetName, waitingOn } from '../../utils/tasks'

interface Props {
  task: Task
  showList?: boolean
  /** Told when the box is ticked here, so the view can keep the task visible for an untick. */
  onTicked?: (id: string) => void
}

export function TaskCard({ task, showList = true, onTicked }: Props) {
  const { household, selectTask, selectedTaskId, canEdit } = useApp()
  const { lists, conflicts, taskById, dependents } = useData()
  const list = lists.find((l) => l.id === task.listId)
  const conflict = conflicts.get(task.id)
  const editable = canEdit(task)
  const end = finish(task)
  const finished = isFinished(task)
  const waiting = finished ? [] : waitingOn(task, taskById)
  // Unfinished tasks that can't start until this one is finished.
  const unblocks = finished ? [] : (dependents.get(task.id) ?? []).filter((d) => !isFinished(d))

  function toggleDone(checked: boolean) {
    if (checked && waiting.length && !window.confirm(`${waiting.map((w) => `"${w.title}"`).join(', ')} isn't finished yet. Mark "${task.title}" done anyway?`)) return
    if (checked) onTicked?.(task.id)
    updateTask(task.id, { status: checked ? 'done' : 'todo' })
  }

  return (
    <article
      className={`task-card color-${colorKey(task, list)}${selectedTaskId === task.id ? ' selected' : ''}${conflict ? ' conflict' : ''}${waiting.length ? ' waiting' : ''}`}
      onClick={() => selectTask(task.id)}
    >
      <input
        type="checkbox"
        aria-label="Done"
        checked={task.status === 'done'}
        disabled={!editable}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => toggleDone(e.target.checked)}
      />
      <div className="grow">
        <div className="task-title">{task.title}</div>
        <div className="chips">
          <span className={`badge priority-${task.priority}`}>{PRIORITY_LABEL[task.priority]}</span>
          {task.status === 'doing' && <span className="badge">{STATUS_LABEL.doing}</span>}
          {task.status === 'canceled' && <span className="badge canceled">✕ {STATUS_LABEL.canceled}</span>}
          {waiting.length > 0 && (
            <span className="badge waiting" title={`Waiting on: ${waiting.map((w) => w.title).join(', ')}`}>
              ⏳ Waiting on {waiting[0].title}
              {waiting.length > 1 && ` +${waiting.length - 1}`}
            </span>
          )}
          {unblocks.length > 0 && (
            <span className="badge unblocks" title={`Needed before: ${unblocks.map((d) => d.title).join(', ')}`}>
              Unblocks {unblocks.length}
            </span>
          )}
          {showList && list && <span className="badge">{list.name}</span>}
          {task.calendar && (
            <span className="badge calendar" title={task.calendar.location}>
              📅 {task.calendar.time ?? 'All day'}
            </span>
          )}
          {task.context === 'work' && <span className="badge work">Work</span>}
          {task.for?.map((id) => (
            <span key={id} className="badge for">
              {targetName(id, household)}
            </span>
          ))}
          {task.assigneeId && <span className="badge">→ {targetName(task.assigneeId, household)}</span>}
          {task.startDate && (
            <span className="muted small">
              {formatDay(task.startDate)}
              {end && end !== task.startDate && `–${formatDay(end)}`}
            </span>
          )}
          {task.targetDate && <span className="muted small">due {formatDay(task.targetDate)}</span>}
          {task.dependsOn.length > 0 && (
            <span className="muted small" title="Has prerequisites">
              ⛓ {task.dependsOn.length}
            </span>
          )}
          {conflict && <span className="badge danger">⚠ {conflict}</span>}
        </div>
      </div>
    </article>
  )
}
