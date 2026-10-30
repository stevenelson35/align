import { useEffect } from 'react'
import { addDays, today } from '../../engine/dates'
import { saveSparks, useSparks } from '../../firebase/rewards'
import { useApp, useData } from '../../hooks/useApp'
import { loggableGoals, met } from '../../utils/goals'
import { daySparks, type SparkDays } from '../../utils/sparks'

/**
 * Keeps your sparks up to date from your goals: the last 7 days are worked out again whenever goals change (so
 * logging yesterday late still counts) and only days that differ are saved. Members only.
 */
export function SparksKeeper() {
  const { uid, member, household, isMember } = useApp()
  const { goals } = useData()
  const all = useSparks(isMember)
  const mine = all[uid]
  const day = today()
  const counts: SparkDays = {}
  for (let k = 0; k < 7; k++) {
    const d = addDays(day, -k)
    const { forDay } = loggableGoals(goals, uid, member.role, household, d)
    counts[d] = daySparks(forDay.filter((g) => met(g, g.log?.[d], d)).length, forDay.length)
  }
  const changed = Object.fromEntries(Object.entries(counts).filter(([d, n]) => (mine?.[d] ?? 0) !== n))
  const key = JSON.stringify(changed)

  useEffect(() => {
    if (!isMember || key === '{}') return
    saveSparks(uid, JSON.parse(key) as SparkDays).catch(() => {}) // tried again on the next change
  }, [isMember, uid, key])

  return null
}
