import { addDays, today } from '../../engine/dates'
import type { Goal } from '../../types'
import { amount, history, totalTo } from '../../utils/goals'

const W = 72
const H = 22
const PAD = 3

/**
 * A goal's last two weeks at a glance (no axes): check = a row of day cells; tally = column heights; progressive /
 * measure = what you logged, with the suggestion or target as a faint dashed line; total = the running total
 * toward its target. The last value gets a dot. Nothing shows until there's something to draw.
 */
export function GoalSparkline({ goal, days = 14 }: { goal: Goal; days?: number }) {
  const to = today()
  const data = history(goal, addDays(to, -(days - 1)), to)
  const u = (n: number | undefined) => amount(n, goal.unit)

  if (goal.kind === 'check') {
    const done = data.filter((d) => d.entry?.done).length
    if (!done) return null
    const cell = (W - (data.length - 1)) / data.length
    return (
      <svg className="sparkline" width={W} height={H} role="img" aria-label={`${goal.name}: done ${done} of the last ${data.length} days`}>
        <title>{`Done ${done} of the last ${data.length} days`}</title>
        {data.map((d, i) => (
          <rect key={d.day} x={i * (cell + 1)} y={H / 2 - cell / 2} width={cell} height={cell} rx={1} className={d.entry?.done ? 'spark-on' : 'spark-off'} />
        ))}
      </svg>
    )
  }

  const points = data
    .map((d, i) => ({ i, v: goal.kind === 'tally' ? d.entry?.count : goal.kind === 'total' ? (d.entry?.value !== undefined || i === data.length - 1 ? totalTo(goal, d.day) : undefined) : d.entry?.value }))
    .filter((p): p is { i: number; v: number } => p.v !== undefined)
  if (points.length < (goal.kind === 'total' ? 1 : 2)) return null
  const ref = goal.kind === 'tally' ? goal.perDay : goal.kind === 'progressive' ? data.at(-1)?.suggested : goal.target
  const values = [...points.map((p) => p.v), ...(ref !== undefined ? [ref] : []), ...(goal.kind === 'tally' || goal.kind === 'total' ? [0] : [])]
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const x = (i: number) => PAD + (data.length === 1 ? 0 : (i / (data.length - 1)) * (W - 2 * PAD))
  const y = (v: number) => H - PAD - ((v - lo) / (hi - lo || 1)) * (H - 2 * PAD)
  const last = points.at(-1)!
  const path = points.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const summary = `${goal.name}: ${points.length > 1 ? `${u(points[0].v)} → ` : ''}${u(last.v)}${ref !== undefined ? ` (${goal.kind === 'progressive' ? 'suggested' : goal.kind === 'tally' ? 'goal' : 'target'} ${u(ref)})` : ''}, last ${days} days`
  return (
    <svg className="sparkline" width={W} height={H} role="img" aria-label={summary}>
      <title>{summary}</title>
      {ref !== undefined && <line className="spark-ref" x1={PAD} x2={W - PAD} y1={y(ref)} y2={y(ref)} />}
      <path className="spark-line" d={path} />
      <circle className="spark-dot" cx={x(last.i)} cy={y(last.v)} r={2.5} />
    </svg>
  )
}
