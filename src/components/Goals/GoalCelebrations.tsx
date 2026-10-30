import { useEffect, useRef } from 'react'
import { today } from '../../engine/dates'
import { useApp, useData } from '../../hooks/useApp'
import { loggableGoals, met } from '../../utils/goals'
import { celebrate } from '../../utils/celebrate'

/**
 * Watches today's goals and celebrates when one you logged becomes met, however it was logged (Today, the goal's
 * page, Log all). The size grows with how many of today's goals are done. Nothing on first load, for goals others
 * logged, or for days other than today.
 */
export function GoalCelebrations() {
  const { uid, member, household } = useApp()
  const { goals } = useData()
  const day = today()
  const { forDay } = loggableGoals(goals, uid, member.role, household, day)
  const metIds = forDay.filter((g) => met(g, g.log?.[day], day)).map((g) => g.id)
  const signature = `${day}|${forDay.length}|${metIds.join(',')}`
  const before = useRef<{ day: string; ids: Set<string> } | null>(null)

  useEffect(() => {
    const now = new Set(metIds)
    const prev = before.current
    before.current = { day, ids: now }
    if (!prev || prev.day !== day) return // first look (or a new day): just remember
    const fresh = forDay.filter((g) => now.has(g.id) && !prev.ids.has(g.id) && g.log?.[day]?.by === uid)
    if (fresh.length !== 1) return // none, or several at once (data arriving, not a tap)
    const el = document.querySelector(`[data-goal-id="${fresh[fresh.length - 1].id}"]`)
    const r = el?.getBoundingClientRect()
    const onScreen = r && r.bottom > 0 && r.top < window.innerHeight
    celebrate({ done: now.size, total: forDay.length, color: member.color, ...(onScreen ? { x: r.left + Math.min(40, r.width / 2), y: r.top + r.height / 2 } : {}) })
    // signature stands for the goals and what's met
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  return null
}
