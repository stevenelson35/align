import { useEffect, useState } from 'react'
import { timerValue } from '../../utils/goals'
import { Icon } from '../UI/Icon'

interface TimerState {
  /** When the current run started (ms), or null while paused. */
  startedAt: number | null
  /** Time from earlier runs (ms). */
  elapsed: number
}

const key = (goalId: string) => `align-goal-timer-${goalId}`
const load = (goalId: string): TimerState => {
  try {
    return { startedAt: null, elapsed: 0, ...JSON.parse(localStorage.getItem(key(goalId)) ?? '{}') }
  } catch {
    return { startedAt: null, elapsed: 0 }
  }
}
const store = (goalId: string, s: TimerState) =>
  s.startedAt === null && s.elapsed === 0 ? localStorage.removeItem(key(goalId)) : localStorage.setItem(key(goalId), JSON.stringify(s))

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`
}

/**
 * An optional stopwatch on a goal (Edit goal → Show a timer): Start / Pause, Reset, and "Add 12.5 min", which adds the
 * time to that day's entry and starts the timer over, so several walks in a day add up (in the goal's unit; minutes
 * unless it says hours or seconds). It keeps running on this device if you leave the page or close the app.
 */
export function GoalTimer({ goalId, unit, onAdd, disabled }: { goalId: string; unit?: string; onAdd: (value: number) => void; disabled?: boolean }) {
  const [state, setState] = useState<TimerState>(() => load(goalId))
  const [now, setNow] = useState(() => Date.now())
  const running = state.startedAt !== null
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [running])
  const total = state.elapsed + (state.startedAt !== null ? now - state.startedAt : 0)
  const update = (s: TimerState) => {
    store(goalId, s)
    setState(s)
    setNow(Date.now())
  }
  const value = timerValue(total, unit)
  const unitLabel = /^(h|hr|hrs|hour|hours|s|sec|secs|second|seconds)$/i.test((unit ?? '').trim()) ? unit : 'min'

  return (
    <div className={`goal-timer${running ? ' running' : ''}`} role="group" aria-label="Timer">
      <Icon name="timer" />
      <span className="timer-clock" aria-live="off">
        {clock(total)}
      </span>
      <button
        type="button"
        className="link small"
        disabled={disabled}
        onClick={() => update(running ? { startedAt: null, elapsed: total } : { ...state, startedAt: Date.now() })}
        aria-label={running ? 'Pause the timer' : 'Start the timer'}
      >
        <Icon name={running ? 'pause' : 'play'} /> {running ? 'Pause' : total ? 'Resume' : 'Start'}
      </button>
      {total > 0 && (
        <>
          <button
            type="button"
            className="link small"
            disabled={disabled || value <= 0}
            onClick={() => {
              onAdd(value)
              update({ startedAt: null, elapsed: 0 })
            }}
            title="Add this time to the day's entry and start over"
          >
            <Icon name="plus" /> Add {value} {unitLabel}
          </button>
          <button type="button" className="link small" onClick={() => update({ startedAt: null, elapsed: 0 })} aria-label="Reset the timer">
            Reset
          </button>
        </>
      )}
    </div>
  )
}
