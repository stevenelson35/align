import { today } from '../../engine/dates'
import { useApp, useData } from '../../hooks/useApp'
import { useDailyFlag } from '../../hooks/useDailyFlag'
import { appliesOn, goalGroups, met, otherLoggers } from '../../utils/goals'
import { canLogGoal } from '../../utils/tasks'
import { GoalControl } from './GoalControl'
import { SectionHeader } from '../UI/SectionHeader'

/** The day's goals you can log, at the top of a day view: log them right there. Hidden each morning (Show opens them for the day). */
export function GoalsStrip({ day }: { day: string }) {
  const { navigate, uid, member, household } = useApp()
  const { goals } = useData()
  const [hidden, setHidden] = useDailyFlag('align-goals-hidden', true)
  // Only the goals you log; ones you can just view are on the Goals page.
  // Your own goals first, then shared ones (with who else logs them), like the Goals page.
  const forDay = goalGroups(goals, uid, member.role, household)
    .filter((group) => group.key === 'mine' || group.key === 'shared')
    .flatMap((group) => group.goals)
    .filter((g) => appliesOn(g, day) && canLogGoal(g, uid, member.role))
  if (!forDay.length) return null
  const metCount = forDay.filter((g) => met(g, g.log?.[day], day)).length
  return (
    <div className="day-section goals-strip">
      <SectionHeader icon="goal" title="Goals" count={`${metCount}/${forDay.length}`}>
        <button type="button" className="link small" onClick={() => navigate({ view: 'goals' })}>
          Manage
        </button>
        <button type="button" className="link small" onClick={() => setHidden(!hidden)} aria-expanded={!hidden}>
          {hidden ? 'Show' : 'Hide'}
        </button>
      </SectionHeader>
      {!hidden && (
        <>
          {day > today() && <p className="muted small">Log goals on the day.</p>}
          <div className="goal-list">
            {forDay.map((g) => (
              <GoalControl key={g.id} goal={g} day={day} who={otherLoggers(g, household, uid) || undefined} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
