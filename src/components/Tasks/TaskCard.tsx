import { formatDay } from '../../engine/dates'
import { finish } from '../../engine/scheduling'
import { updateTask } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { Task } from '../../types'
import { colorKey, PRIORITY_LABEL, STATUS_LABEL, targetName } from '../../utils/tasks'

interface Props {
  task: Task
  showList?: boolean
  /** Told when the box is ticked here, so the view can keep the task visible for an untick. */
  onTicked?: (id: string) => void
}

export function TaskCard({ task, showList = true, onTicked }: Props) {
  const { household, selectTask, selectedTaskId, canEdit } = useApp()
  const { lists, conflicts } = useData()
  const list = lists.find((l) => l.id === task.listId)
  const conflict = conflicts.get(task.id)
  const editable = canEdit(task)
  const end = finish(task)

  return (
    <article
      className={`task-card color-${colorKey(task, list)}${selectedTaskId === task.id ? ' selected' : ''}${conflict ? ' conflict' : ''}`}
      onClick={() => selectTask(task.id)}
    >
      <input
        type="checkbox"
        aria-label="Done"
        checked={task.status === 'done'}
        disabled={!editable}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          if (e.target.checked) onTicked?.(task.id)
          updateTask(task.id, { status: e.target.checked ? 'done' : 'todo' })
        }}
      />
      <div className="grow">
        <div className="task-title">{task.title}</div>
        <div className="chips">
          <span className={`badge priority-${task.priority}`}>{PRIORITY_LABEL[task.priority]}</span>
          {task.status === 'doing' && <span className="badge">{STATUS_LABEL.doing}</span>}
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
