import { formatDay } from '../../engine/dates'
import { finish } from '../../engine/scheduling'
import { updateTask, withStatus } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { Task } from '../../types'
import { safeUrl } from '../../utils/links'
import { colorKey, isFinished, PRIORITY_LABEL, STATUS_LABEL, targetName, waitingOn } from '../../utils/tasks'
import { Icon } from '../UI/Icon'
import { AUDIENCE_ICON, audienceLabel, audienceOf } from '../../utils/audience'
import { EntryRow } from '../Entries/EntryRow'
import type { EntrySize } from '../../utils/entries'

interface Props {
  task: Task
  showList?: boolean
  /** Told when the box is ticked here, so the view can keep the task visible for an untick. */
  onTicked?: (id: string) => void
  /** The day a tick counts for (a day view of yesterday records it as done yesterday). Default today. */
  day?: string
  /** Day view: "⏭ next day" and "✕ won't do" buttons on unfinished tasks. */
  dayActions?: { push?: () => void; skip: () => void }
  /** A line under the title, e.g. "→ moved to Wed, Oct 21". */
  note?: string
}

export function TaskCard({ task, showList = true, onTicked, day, dayActions, note, size = 'medium' }: Props & { size?: EntrySize }) {
  const { household, canEdit } = useApp()
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
    updateTask(task.id, withStatus(task, checked ? 'done' : 'todo', day))
  }

  const link = task.url ? safeUrl(task.url) : null
  return (
    <EntryRow
      as="div"
      entry={task}
      size={size}
      className={`task-row color-${colorKey(task, list)}${finished ? ' finished' : ''}${conflict ? ' conflict' : ''}${waiting.length ? ' waiting' : ''}`}
      check={{ checked: task.status === 'done', disabled: !editable, label: `Done: ${task.title}`, onChange: toggleDone }}
      chips={
        <>
          {note && <span className="muted small">{note}</span>}
          <span className={`badge priority-${task.priority}`}>{PRIORITY_LABEL[task.priority]}</span>
          {task.status === 'doing' && <span className="badge">{STATUS_LABEL.doing}</span>}
          {task.status === 'canceled' && <span className="badge canceled">✕ {STATUS_LABEL.canceled}</span>}
          {waiting.length > 0 && (
            <span className="badge waiting" title={`Waiting on: ${waiting.map((w) => w.title).join(', ')}`}>
              <Icon name="waiting" /> Waiting on {waiting[0].title}
              {waiting.length > 1 && ` +${waiting.length - 1}`}
            </span>
          )}
          {unblocks.length > 0 && (
            <span className="badge unblocks" title={`Needed before: ${unblocks.map((d) => d.title).join(', ')}`}>
              Unblocks {unblocks.length}
            </span>
          )}
          {showList && list && (
            <span className="badge" title={`Who can see it: ${audienceLabel(audienceOf(list))}`}>
              {list.visibility !== 'family' && (
                <>
                  <Icon name={AUDIENCE_ICON[audienceOf(list)]} />{' '}
                </>
              )}
              {list.name}
            </span>
          )}
          {task.calendar && (
            <span className="badge calendar" title={task.calendar.location}>
              <Icon name="calendar" /> {task.calendar.time ?? 'All day'}
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
              <Icon name="chain" /> {task.dependsOn.length}
            </span>
          )}
          {conflict && (
            <span className="badge danger">
              <Icon name="warning" /> {conflict}
            </span>
          )}
        </>
      }
      trail={
        <>
          {link && (
            <a className="row-action" href={link} target="_blank" rel="noopener noreferrer" title="Open the link" aria-label={`Open the link for ${task.title}`}>
              <Icon name="external" />
            </a>
          )}
          {dayActions && editable && !finished && (
            <>
              {dayActions.push && (
                <button type="button" className="row-action" title="Push to the next day" aria-label={`Push ${task.title} to the next day`} onClick={() => dayActions.push?.()}>
                  <Icon name="skip" />
                </button>
              )}
              <button type="button" className="row-action" title="Won't do (cancel it)" aria-label={`Won't do ${task.title}`} onClick={() => dayActions.skip()}>
                <Icon name="close" />
              </button>
            </>
          )}
        </>
      }
    />
  )
}
