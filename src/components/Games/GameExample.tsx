/**
 * A small made-up example of each logic puzzle (never today's board), drawn crisply at any size: on the Games page's
 * tiles and on a puzzle's Start screen, so it's clear at a glance what kind of game it is.
 */
const INK = '#1f2328'
const LINE = 'rgb(31 35 40 / 0.18)'
const PAPER = '#ffffff'

function Grid({ n }: { n: number }) {
  const lines = []
  for (let k = 1; k < n; k++) lines.push(<path key={`v${k}`} d={`M${k} 0V${n}M0 ${k}H${n}`} stroke={LINE} strokeWidth={0.03} />)
  return <>{lines}</>
}

function Trail() {
  // A 4 × 4 path: along the top, back, along again, back (numbers on its 1st, 6th, 11th and last squares).
  const path = [0, 1, 2, 3, 7, 6, 5, 4, 8, 9, 10, 11, 15, 14, 13, 12]
  const pt = (i: number) => `${(i % 4) + 0.5} ${Math.floor(i / 4) + 0.5}`
  const numbers: [number, number][] = [
    [0, 1],
    [6, 2],
    [10, 3],
    [12, 4],
  ]
  return (
    <svg viewBox="0 0 4 4">
      <rect width={4} height={4} fill="#efe9fb" />
      <Grid n={4} />
      <polyline points={path.map(pt).join(' ')} fill="none" stroke="#8250df" strokeWidth={0.14} strokeLinejoin="round" strokeLinecap="round" />
      {numbers.map(([i, v]) => (
        <g key={i}>
          <circle cx={(i % 4) + 0.5} cy={Math.floor(i / 4) + 0.5} r={0.32} fill={INK} />
          <text x={(i % 4) + 0.5} y={Math.floor(i / 4) + 0.62} fontSize={0.36} fontWeight={700} textAnchor="middle" fill="#fff">
            {v}
          </text>
        </g>
      ))}
    </svg>
  )
}

function Balance() {
  const rows = ['●○●○', '○●○●', '●●○○', '○○●●']
  return (
    <svg viewBox="0 0 4 4">
      <rect width={4} height={4} fill={PAPER} />
      <Grid n={4} />
      {rows.flatMap((row, r) =>
        [...row].map((ch, c) => <circle key={`${r}${c}`} cx={c + 0.5} cy={r + 0.5} r={0.27} fill={ch === '●' ? '#2563eb' : '#e87929'} stroke={INK} strokeWidth={0.04} />),
      )}
      {/* = between two that match (row 3), × between two that differ (row 1). */}
      {(
        [
          [1, 2.5, '='],
          [3, 0.5, '×'],
        ] as const
      ).map(([x, y, t]) => (
        <g key={t}>
          <circle cx={x} cy={y} r={0.17} fill={PAPER} stroke={LINE} strokeWidth={0.03} />
          <text x={x} y={y + 0.11} fontSize={0.3} fontWeight={700} textAnchor="middle" fill={INK}>
            {t}
          </text>
        </g>
      ))}
    </svg>
  )
}

function Stars() {
  // Four areas (the quarters), a star in each, one per row and column, none touching.
  const colors = ['#f9dfb3', '#bfe0f3', '#c9eac2', '#d6cdf4']
  const stars = [
    [0, 1],
    [1, 3],
    [2, 0],
    [3, 2],
  ]
  return (
    <svg viewBox="0 0 4 4">
      {[0, 1, 2, 3].map((q) => (
        <rect key={q} x={(q % 2) * 2} y={Math.floor(q / 2) * 2} width={2} height={2} fill={colors[q]} />
      ))}
      <Grid n={4} />
      <path d="M2 0V4M0 2H4" stroke={INK} strokeWidth={0.09} />
      <rect width={4} height={4} fill="none" stroke={INK} strokeWidth={0.12} />
      {stars.map(([r, c]) => (
        <text key={`${r}${c}`} x={c + 0.5} y={r + 0.68} fontSize={0.6} textAnchor="middle" fill={INK}>
          ★
        </text>
      ))}
    </svg>
  )
}

function Blocks() {
  const rects: [number, number, number, number, number, number, string][] = [
    // row, col, height, width, number's row, number's col, color
    [0, 0, 2, 2, 0, 0, '#cfe3ff'],
    [0, 2, 1, 2, 0, 3, '#ffe0c2'],
    [1, 2, 3, 2, 2, 3, '#d8f2d0'],
    [2, 0, 2, 1, 3, 0, '#f6d3ec'],
    [2, 1, 2, 1, 2, 1, '#fff2b8'],
  ]
  return (
    <svg viewBox="0 0 4 4">
      {rects.map(([r, c, h, w, nr, nc, color]) => (
        <g key={`${r}${c}`}>
          <rect x={c + 0.04} y={r + 0.04} width={w - 0.08} height={h - 0.08} rx={0.1} fill={color} stroke={INK} strokeWidth={0.05} />
          <text x={nc + 0.5} y={nr + 0.66} fontSize={0.48} fontWeight={700} textAnchor="middle" fill={INK}>
            {h * w}
          </text>
        </g>
      ))}
    </svg>
  )
}

function SumUp() {
  const tiles: [number, string][] = [
    [2, '#ede0c8'],
    [2, '#ede0c8'],
    [4, '#f2c48f'],
    [1, '#e8e3d9'],
    [1, '#e8e3d9'],
    [8, '#f5a46b'],
    [0, ''],
    [4, '#f2c48f'],
    [8, '#f5a46b'],
  ]
  return (
    <svg viewBox="0 0 3 3">
      {tiles.map(([v, color], i) =>
        v ? (
          <g key={i}>
            <rect x={(i % 3) + 0.06} y={Math.floor(i / 3) + 0.06} width={0.88} height={0.88} rx={0.14} fill={color} />
            <text x={(i % 3) + 0.5} y={Math.floor(i / 3) + 0.66} fontSize={0.42} fontWeight={700} textAnchor="middle" fill={v >= 8 ? '#fff' : '#3d3a35'}>
              {v}
            </text>
          </g>
        ) : (
          <rect key={i} x={(i % 3) + 0.06} y={Math.floor(i / 3) + 0.06} width={0.88} height={0.88} rx={0.14} fill="rgb(208 215 222 / 0.5)" />
        ),
      )}
      {/* The first 2 swiped onto the next: they'll make a 4. */}
      <path d="M0.62 0.5H1.3" stroke="#8250df" strokeWidth={0.09} strokeLinecap="round" />
      <path d="M1.2 0.38L1.36 0.5L1.2 0.62" fill="none" stroke="#8250df" strokeWidth={0.09} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LightsOut() {
  const lit = new Set([1, 5, 6, 7, 11, 13, 17, 18, 19, 23])
  return (
    <svg viewBox="0 0 5 5">
      {Array.from({ length: 25 }, (_, i) => (
        <rect key={i} x={(i % 5) + 0.08} y={Math.floor(i / 5) + 0.08} width={0.84} height={0.84} rx={0.12} fill={lit.has(i) ? '#f3c969' : '#d0d7de'} />
      ))}
    </svg>
  )
}

function Wordle() {
  // Three guesses as colors only: gray (not in it), yellow (elsewhere), green (right place).
  const rows = ['AAPAA', 'PCAAC', 'CCCCC']
  const color = { C: '#538d4e', P: '#c9b458', A: '#787c7e' } as const
  return (
    <svg viewBox="0 0 5 3">
      {rows.flatMap((row, r) => [...row].map((m, c) => <rect key={`${r}${c}`} x={c + 0.06} y={r + 0.06} width={0.88} height={0.88} rx={0.08} fill={color[m as keyof typeof color]} />))}
    </svg>
  )
}

const EXAMPLES: Record<string, () => React.JSX.Element> = { trail: Trail, balance: Balance, stars: Stars, blocks: Blocks, combine: SumUp, 'lights-out': LightsOut, wordle: Wordle }

/** The example for a game, or null if it has none (Wordle, Lights Out and the others draw their own). */
export function GameExample({ id, className = '' }: { id: string; className?: string }) {
  const Drawing = EXAMPLES[id]
  if (!Drawing) return null
  return (
    <span className={`game-example ${className}`} role="img" aria-label="An example (not today’s puzzle)">
      <Drawing />
    </span>
  )
}
