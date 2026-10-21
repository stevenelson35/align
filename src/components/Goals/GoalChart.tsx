import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { addDays, formatDay, today } from '../../engine/dates'
import type { Goal } from '../../types'
import { amount, decreasing, history, met, totalTo } from '../../utils/goals'

/** Measured width, so text and marks stay at real pixel sizes on a phone (no scaled-down viewBox text). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(320)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.round(e.contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** Clean axis ticks (1, 2 or 5 × 10ⁿ steps). */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min]
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const out = []
  for (let v = Math.floor(min / step) * step; v <= max + step / 2; v += step) out.push(Math.round(v * 1000) / 1000)
  return out
}

type Tip = { x: number; y: number; lines: string[] } | null

/**
 * A goal's history (DESIGN.md §5.6). check: a strip of day squares. tally: a column per day with the daily goal as a
 * line. progressive / measure: what you did vs the suggestion or target, two lines. total: the running total vs
 * the target. Hover or tap for values; the
 * table view below lists them all.
 */
export function GoalChart({ goal, days }: { goal: Goal; days: number }) {
  const to = today()
  const data = history(goal, addDays(to, -(days - 1)), to)
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<Tip>(null)
  const u = (n: number | undefined) => amount(n, goal.unit)

  if (!data.length) return <p className="muted small">No days in this range.</p>

  if (goal.kind === 'check') {
    const doneDays = data.filter((d) => d.entry?.done).length
    let streak = 0
    for (let i = data.length - 1; i >= 0 && data[i].entry?.done; i--) streak++
    return (
      <div className="goal-chart" ref={ref}>
        <p className="chart-headline">
          Done <strong>{doneDays}</strong> of {data.length} days{streak > 1 && <> · streak <strong>{streak}</strong></>}
        </p>
        <div className="check-strip" onPointerLeave={() => setTip(null)}>
          {data.map((d) => (
            <span
              key={d.day}
              className={`check-cell${d.entry?.done ? ' on' : ''}`}
              tabIndex={0}
              aria-label={`${formatDay(d.day)}: ${d.entry?.done ? 'done' : 'not done'}`}
              onPointerEnter={(e) => setTip({ x: e.currentTarget.offsetLeft + 8, y: e.currentTarget.offsetTop, lines: [formatDay(d.day), d.entry?.done ? 'Done' : 'Not done'] })}
              onFocus={(e) => setTip({ x: e.currentTarget.offsetLeft + 8, y: e.currentTarget.offsetTop, lines: [formatDay(d.day), d.entry?.done ? 'Done' : 'Not done'] })}
              onBlur={() => setTip(null)}
            />
          ))}
        </div>
        <Tooltip tip={tip} />
      </div>
    )
  }

  const H = 200
  const pad = { l: 36, r: 44, t: 12, b: 24 }
  const plotW = width - pad.l - pad.r
  const plotH = H - pad.t - pad.b
  const n = data.length
  const xAt = (i: number) => pad.l + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)

  if (goal.kind === 'tally') {
    const perDay = goal.perDay ?? 1
    const counts = data.map((d) => d.entry?.count ?? 0)
    const ticks = niceTicks(0, Math.max(perDay, ...counts))
    const top = ticks.at(-1) ?? perDay
    const yAt = (v: number) => pad.t + plotH - (v / top) * plotH
    const band = plotW / n
    const barW = Math.max(2, Math.min(24, band - 2))
    const metDays = data.filter((d) => met(goal, d.entry, d.day)).length
    return (
      <div className="goal-chart" ref={ref}>
        <p className="chart-headline">
          Met the goal on <strong>{metDays}</strong> of {n} days
        </p>
        <svg width={width} height={H} role="img" aria-label={`${goal.name}: times per day over ${n} days`} onPointerLeave={() => setTip(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={pad.l} x2={width - pad.r} y1={yAt(t)} y2={yAt(t)} />
              <text className="tick" x={pad.l - 6} y={yAt(t) + 4} textAnchor="end">
                {t}
              </text>
            </g>
          ))}
          {counts.map((c, i) => {
            const x = pad.l + band * i + (band - barW) / 2
            const y = yAt(c)
            const h = pad.t + plotH - y
            const r = Math.min(4, h, barW / 2)
            const show = () => setTip({ x: x + barW / 2, y, lines: [formatDay(data[i].day), `${c} of ${u(perDay)}`] })
            return (
              <g key={data[i].day}>
                {c > 0 && <path className="bar" d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + h} Z`} />}
                <rect className="hit" x={pad.l + band * i} y={pad.t} width={band} height={plotH} onPointerEnter={show} onPointerDown={show} />
              </g>
            )
          })}
          <line className="reference" x1={pad.l} x2={width - pad.r} y1={yAt(perDay)} y2={yAt(perDay)} />
          <text className="label" x={width - pad.r + 4} y={yAt(perDay) + 4}>
            goal {perDay}
          </text>
          <XLabels data={data} xAt={(i) => pad.l + band * i + band / 2} y={H - 6} />
        </svg>
        <Tooltip tip={tip} />
      </div>
    )
  }

  // progressive / measure: actual vs suggestion (or target); total: the running total vs the target
  const total = goal.kind === 'total'
  const actual = data
    .map((d, i) => ({ i, v: total ? (d.entry?.value !== undefined || i === data.length - 1 || i === 0 ? totalTo(goal, d.day) : undefined) : d.entry?.value }))
    .filter((p): p is { i: number; v: number } => p.v !== undefined)
  const ref2 = data.map((d, i) => ({ i, v: d.suggested })).filter((p): p is { i: number; v: number } => p.v !== undefined)
  const values = [...actual.map((p) => p.v), ...ref2.map((p) => p.v)]
  // Counting up from nothing starts the axis at 0; a weight going down from 200 to 169 doesn't.
  const ticks = niceTicks(Math.min(...values, total || (goal.kind === 'progressive' && !decreasing(goal)) ? 0 : Infinity), Math.max(...values))
  const lo = ticks[0]
  const hi = ticks.at(-1) ?? lo + 1
  const yAt = (v: number) => pad.t + plotH - ((v - lo) / (hi - lo || 1)) * plotH
  // A running total only changes on the days something is added, so it steps.
  const path = (pts: { i: number; v: number }[], step = false) =>
    pts.map((p, k) => (k === 0 ? `M${xAt(p.i)},${yAt(p.v)}` : step ? `H${xAt(p.i)} V${yAt(p.v)}` : `L${xAt(p.i)},${yAt(p.v)}`)).join(' ')
  const refName = goal.kind === 'progressive' ? 'Suggested' : 'Target'
  const actName = goal.kind === 'progressive' ? 'Did' : total ? 'Total' : 'Measured'
  const lastA = actual.at(-1)
  const lastR = ref2.at(-1)
  const labelsCollide = lastA && lastR && Math.abs(yAt(lastA.v) - yAt(lastR.v)) < 14 && lastA.i === lastR.i

  function onMove(e: PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    const i = Math.max(0, Math.min(n - 1, Math.round(((e.clientX - box.left) / box.width) * (n - 1))))
    const d = data[i]
    setTip({
      x: xAt(i),
      y: pad.t,
      lines: [
        formatDay(d.day),
        total
          ? `${u(totalTo(goal, d.day))} total${d.entry?.value ? ` (+${u(d.entry.value)} that day)` : ''}`
          : d.entry?.value !== undefined
            ? `${u(d.entry.value)} ${actName.toLowerCase()}`
            : 'not logged',
        ...(d.suggested !== undefined ? [`${u(d.suggested)} ${refName.toLowerCase()}`] : []),
        ...(d.entry?.note ? [d.entry.note.length > 60 ? `${d.entry.note.slice(0, 60)}…` : d.entry.note] : []),
      ],
    })
  }

  return (
    <div className="goal-chart" ref={ref}>
      <div className="chart-legend">
        <span>
          <i className="key s1" /> {actName}
        </span>
        <span>
          <i className="key s2" /> {refName}
        </span>
      </div>
      {actual.length === 0 && <p className="muted small">Nothing logged in this range yet.</p>}
      <svg width={width} height={H} role="img" aria-label={`${goal.name}: ${actName.toLowerCase()} vs ${refName.toLowerCase()} over ${n} days`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={pad.l} x2={width - pad.r} y1={yAt(t)} y2={yAt(t)} />
            <text className="tick" x={pad.l - 6} y={yAt(t) + 4} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {ref2.length > 0 && <path className="line s2" d={path(ref2)} />}
        {actual.length > 0 && <path className="line s1" d={path(actual, total)} />}
        {actual
          .filter((p) => !total || data[p.i].entry?.value !== undefined)
          .map((p) => (
            <circle key={p.i} className="dot s1" cx={xAt(p.i)} cy={yAt(p.v)} r={4} />
          ))}
        {lastA && (
          <text className="label" x={xAt(lastA.i) + 8} y={yAt(lastA.v) + 4}>
            {lastA.v}
          </text>
        )}
        {lastR && !labelsCollide && (
          <text className="label muted-label" x={xAt(lastR.i) + 8} y={yAt(lastR.v) + 4}>
            {lastR.v}
          </text>
        )}
        <XLabels data={data} xAt={xAt} y={H - 6} />
        {tip && <line className="crosshair" x1={tip.x} x2={tip.x} y1={pad.t} y2={pad.t + plotH} />}
        <rect className="hit" x={pad.l} y={pad.t} width={plotW} height={plotH} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setTip(null)} />
      </svg>
      <Tooltip tip={tip} />
    </div>
  )
}

/** First, middle and last dates under the plot. */
function XLabels({ data, xAt, y }: { data: { day: string }[]; xAt: (i: number) => number; y: number }) {
  const idx = data.length > 2 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : data.map((_, i) => i)
  return (
    <>
      {[...new Set(idx)].map((i, k, all) => (
        <text key={i} className="tick" x={xAt(i)} y={y} textAnchor={k === 0 && all.length > 1 ? 'start' : k === all.length - 1 && all.length > 1 ? 'end' : 'middle'}>
          {formatDay(data[i].day).replace(/^\w+, /, '')}
        </text>
      ))}
    </>
  )
}

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null
  return (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }} role="status">
      <strong>{tip.lines[0]}</strong>
      {tip.lines.slice(1).map((l) => (
        <div key={l}>{l}</div>
      ))}
    </div>
  )
}
