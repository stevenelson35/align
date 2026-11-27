import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { today } from '../../engine/dates'
import { recordGameScore, useGameScores } from '../../firebase/games'
import { earnDaily } from '../../firebase/play'
import { gameById, type GameId } from '../../games/catalog'
import {
  balanceConflicts,
  balanceSolved,
  blocksSolved,
  daySeed,
  makeBalance,
  makeCombine,
  combineMove,
  combineSolved,
  combineStuck,
  makeBlocks,
  makeStars,
  makeTrail,
  neighbors,
  rectCells,
  starConflicts,
  starsSolved,
  trailOnTrack,
  trailSolved,
  type BalancePuzzle,
  type BlocksPuzzle,
  type Cell,
  type Mark,
  type Rect,
  type StarsPuzzle,
  type TrailPuzzle,
  type LogicGameId,
} from '../../games/logic'
import { useApp } from '../../hooks/useApp'
import { celebrate } from '../../utils/celebrate'
import { Icon } from '../UI/Icon'
import { HelpTip } from '../UI/HelpTip'


const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

const RULES: Record<LogicGameId, string> = {
  trail: 'Draw one path from 1 that passes every number in order and fills every square. Drag from 1 (or tap the next square); drag back, or tap an earlier square, to undo.',
  balance: 'Fill every square with ● or ○ (tap to change). Each row and column has three of each; never three of one side by side; = means the two squares match, × means they differ.',
  stars: 'Put one ★ in every row, every column and every colored area. Stars can’t touch, not even corner to corner. Tap once for × (a note), twice for ★.',
  combine: 'Swipe a square onto a neighbor with the same number (or tap one, then the other): they become one square holding the sum. Combine them all into one. Bigger grids are harder.',
  blocks: 'Cut the grid into rectangles. Each rectangle holds exactly one number, and the number is how many squares it covers. Tap two corners to make one; tap a rectangle to remove it.',
}

/**
 * The daily logic puzzles (Trail, Balance, Star Fields, Blocks): the same puzzle for everyone each day, timed. Solving
 * saves your best time for the day (the family's times show below) and earns Glider play time once a day.
 */
export function LogicGame({ id, onBack }: { id: LogicGameId; onBack: () => void }) {
  const app = useApp()
  const day = today()
  const game = gameById(id)!
  // Sum Up comes in 3 × 3, 4 × 4 and 5 × 5 (each its own daily puzzle and times); the rest have one size.
  const [size, setSize] = useState(3)
  const seed = daySeed(id === 'combine' ? `combine-${size}` : id, day)
  const scoreSeed = id === 'combine' ? `${day}-${size}` : day
  const [round, setRound] = useState(0)
  const [solvedMs, setSolvedMs] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const startedAt = useRef(0)
  // Nothing shows and the clock doesn't run until Start, so you can look ahead (or skip one) without it counting.
  const [started, setStarted] = useState(false)
  const start = () => {
    startedAt.current = Date.now()
    setElapsed(0)
    setStarted(true)
  }
  const { scores } = useGameScores(id as GameId, scoreSeed, app.canPlay)

  useEffect(() => {
    if (solvedMs !== null || !started) return
    const t = window.setInterval(() => setElapsed(Date.now() - startedAt.current), 500)
    return () => window.clearInterval(t)
  }, [solvedMs, round, started])

  const solved = useCallback(() => {
    if (solvedMs !== null) return
    const ms = Math.max(1, Date.now() - startedAt.current)
    setSolvedMs(ms)
    setElapsed(ms)
    if (!app.canPlay) return
    void earnDaily(app.uid, id, day).catch(() => undefined)
    recordGameScore(app.uid, id as GameId, scoreSeed, { ms })
      .then((best) => {
        const familyBest = !scores.length || ms < (scores[0].best.ms ?? Infinity)
        celebrate({ done: 1, total: 1, message: familyBest ? 'Fastest in the family today!' : best ? 'Solved! New best for today.' : 'Solved!' })
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [solvedMs, app.canPlay, app.uid, id, day, scoreSeed, scores])

  function again() {
    startedAt.current = Date.now()
    setSolvedMs(null)
    setElapsed(0)
    setRound((r) => r + 1)
  }

  const board = (() => {
    const props = { key: `${round}-${size}`, seed, onSolved: solved, done: solvedMs !== null }
    switch (id) {
      case 'trail':
        return <TrailBoard {...props} />
      case 'balance':
        return <BalanceBoard {...props} />
      case 'stars':
        return <StarsBoard {...props} />
      case 'blocks':
        return <BlocksBoard {...props} />
      case 'combine':
        return <CombineBoard {...props} size={size} />
    }
  })()
  const ranked = [...scores].sort((a, b) => (a.best.ms ?? Infinity) - (b.best.ms ?? Infinity))
  const mine = scores.find((s) => s.uid === app.uid)

  return (
    <section className="games-view logic-game">
      <header className="view-header">
        <h2>
          <Icon name="sparkle" /> {game.name}
        </h2>
        <HelpTip topic={id} label={game.name} />
        <span className="muted small">Today’s puzzle, the same for everyone.</span>
        <button type="button" className="secondary small" onClick={onBack}>
          Show All Games
        </button>
      </header>
      <article className="game-card card">
        <p className="small muted logic-rules">{RULES[id]}</p>
        {id === 'combine' && (
          <label className="inline small">
            Grid{' '}
            <select
              value={size}
              onChange={(e) => {
                setSize(Number(e.target.value))
                again()
              }}
            >
              <option value={3}>3 × 3</option>
              <option value={4}>4 × 4 (harder)</option>
              <option value={5}>5 × 5 (hardest)</option>
            </select>
          </label>
        )}
        {!started ? (
          <div className="logic-start">
            {mine?.best.ms ? <p className="small">You’ve solved today’s in {clock(mine.best.ms)}. Play again to try for faster.</p> : <p className="small muted">The board shows and the clock starts when you tap Start.</p>}
            <button type="button" onClick={start}>
              <Icon name="play" /> Start
            </button>
          </div>
        ) : (
          <>
            <div className="game-status row" aria-live="polite">
              <strong>{clock(elapsed)}</strong>
              {solvedMs !== null && <span className="badge">Solved!</span>}
            </div>
            {board}
            {error && <p className="error small">{error}</p>}
            <button type="button" className="secondary small" onClick={again}>
              {solvedMs !== null ? 'Play it again' : 'Start over'}
            </button>
          </>
        )}
      </article>
      <article className="card game-leaderboard">
        <h3>Today’s family times{id === 'combine' ? ` · ${size} × ${size}` : ''}</h3>
        {!ranked.length ? (
          <p className="muted small">Nobody has solved today’s yet.</p>
        ) : (
          <ol>
            {ranked.map((s, i) => (
              <li key={s.uid} className={s.uid === app.uid ? 'game-score-me' : ''}>
                <span className="muted">{i + 1}</span> <strong>{app.household.members[s.uid]?.displayName ?? 'Family member'}</strong>
                <span>{clock(s.best.ms ?? 0)}</span>
              </li>
            ))}
          </ol>
        )}
      </article>
    </section>
  )
}

interface BoardProps {
  seed: number
  onSolved: () => void
  done: boolean
}

/** The square under a finger or pointer, for dragging across the board. */
const cellAt = (x: number, y: number): Cell | null => {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-cell]')
  return el ? Number(el.dataset.cell) : null
}

const gridStyle = (n: number): CSSProperties => ({ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` })

// ---- Trail ----

function TrailBoard({ seed, onSolved, done }: BoardProps) {
  const p: TrailPuzzle = useMemo(() => makeTrail(seed), [seed])
  const n = p.size
  const [path, setPath] = useState<Cell[]>([])
  const dragging = useRef(false)
  const step = (c: Cell, current: Cell[]): Cell[] => {
    const at = current.indexOf(c)
    if (!current.length) return p.numbers[c] === 1 ? [c] : current
    if (at >= 0) return current.slice(0, at + 1)
    return neighbors(current[current.length - 1], n).includes(c) ? [...current, c] : current
  }
  const apply = (c: Cell | null) => {
    if (c === null || done) return
    setPath((current) => {
      // Dragging back over the square before the end takes the last step back.
      const next = current.length > 1 && c === current[current.length - 2] ? current.slice(0, -1) : step(c, current)
      if (next !== current && trailSolved(p, next)) setTimeout(onSolved, 0)
      return next
    })
  }
  const onTrack = trailOnTrack(p, path)
  const center = (c: Cell) => `${((c % n) + 0.5) * (100 / n)},${(Math.floor(c / n) + 0.5) * (100 / n)}`
  return (
    <>
      <div
        className={`logic-board trail-board${onTrack ? '' : ' off-track'}`}
        style={gridStyle(n)}
        onPointerDown={(e) => {
          dragging.current = true
          ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
          apply(cellAt(e.clientX, e.clientY))
        }}
        onPointerMove={(e) => dragging.current && apply(cellAt(e.clientX, e.clientY))}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => (dragging.current = false)}
        role="grid"
        aria-label="Trail"
      >
        <svg className="trail-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {path.length > 1 && <polyline points={path.map(center).join(' ')} />}
        </svg>
        {Array.from({ length: n * n }, (_, c) => (
          <div key={c} data-cell={c} className={`logic-cell${path.includes(c) ? ' on' : ''}${path[path.length - 1] === c ? ' end' : ''}`}>
            {p.numbers[c] !== undefined && <span className="trail-number">{p.numbers[c]}</span>}
          </div>
        ))}
      </div>
      <p className="muted small">
        {path.length} of {n * n} squares{!onTrack ? ' · the numbers must come in order' : ''}
      </p>
    </>
  )
}

// ---- Balance ----

function BalanceBoard({ seed, onSolved, done }: BoardProps) {
  const p: BalancePuzzle = useMemo(() => makeBalance(seed), [seed])
  const n = p.size
  const [grid, setGrid] = useState<(Mark | null)[]>(() => Array.from({ length: n * n }, (_, i) => p.given[i] ?? null))
  const bad = balanceConflicts(p, grid)
  const tap = (i: Cell) => {
    if (done || p.given[i] !== undefined) return
    const next = [...grid]
    next[i] = next[i] === null ? 0 : next[i] === 0 ? 1 : null
    setGrid(next)
    if (balanceSolved(p, next)) setTimeout(onSolved, 0)
  }
  const step = 100 / n
  return (
    <div className="logic-board balance-board" style={gridStyle(n)} role="grid" aria-label="Balance">
      {grid.map((v, i) => (
        <button
          key={i}
          type="button"
          className={`logic-cell${p.given[i] !== undefined ? ' given' : ''}${bad.has(i) ? ' bad' : ''}`}
          onClick={() => tap(i)}
          aria-label={v === null ? 'Empty' : v === 0 ? 'Filled circle' : 'Open circle'}
        >
          {v !== null && <span className={`balance-mark ${v === 0 ? 'dark' : 'light'}`} />}
        </button>
      ))}
      {p.edges.map((e) => {
        const [ra, ca] = [Math.floor(e.a / n), e.a % n]
        const across = e.b === e.a + 1
        const style: CSSProperties = across ? { left: `${(ca + 1) * step}%`, top: `${(ra + 0.5) * step}%` } : { left: `${(ca + 0.5) * step}%`, top: `${(ra + 1) * step}%` }
        return (
          <span key={`${e.a}-${e.b}`} className="balance-edge" style={style} aria-hidden="true">
            {e.same ? '=' : '×'}
          </span>
        )
      })}
    </div>
  )
}

// ---- Star Fields ----

const AREA_COLORS = ['#f6c7c7', '#f9dfb3', '#f3f0a8', '#c9eac2', '#bfe0f3', '#d6cdf4', '#f1c8e6', '#cfe8e0']

function StarsBoard({ seed, onSolved, done }: BoardProps) {
  const p: StarsPuzzle = useMemo(() => makeStars(seed), [seed])
  const n = p.size
  // 0 empty, 1 × (a note), 2 ★
  const [marks, setMarks] = useState<number[]>(() => Array(n * n).fill(0))
  const stars = new Set(marks.flatMap((m, i) => (m === 2 ? [i] : [])))
  const bad = starConflicts(p, stars)
  const tap = (i: Cell) => {
    if (done) return
    const next = [...marks]
    next[i] = (next[i] + 1) % 3
    setMarks(next)
    const s = new Set(next.flatMap((m, j) => (m === 2 ? [j] : [])))
    if (starsSolved(p, s)) setTimeout(onSolved, 0)
  }
  const edge = (i: Cell, j: Cell | null) => (j === null || p.regions[j] !== p.regions[i] ? '2px solid var(--text)' : '1px solid var(--border)')
  return (
    <div className="logic-board stars-board" style={gridStyle(n)} role="grid" aria-label="Star Fields">
      {marks.map((m, i) => {
        const [r, c] = [Math.floor(i / n), i % n]
        return (
          <button
            key={i}
            type="button"
            className={`logic-cell${bad.has(i) ? ' bad' : ''}`}
            onClick={() => tap(i)}
            style={{
              background: AREA_COLORS[p.regions[i] % AREA_COLORS.length],
              borderTop: edge(i, r > 0 ? i - n : null),
              borderBottom: edge(i, r < n - 1 ? i + n : null),
              borderLeft: edge(i, c > 0 ? i - 1 : null),
              borderRight: edge(i, c < n - 1 ? i + 1 : null),
            }}
            aria-label={m === 2 ? 'Star' : m === 1 ? 'Marked empty' : 'Empty'}
          >
            {m === 2 ? '★' : m === 1 ? '×' : ''}
          </button>
        )
      })}
    </div>
  )
}

// ---- Blocks ----

const BLOCK_COLORS = ['#cfe3ff', '#ffe0c2', '#d8f2d0', '#f6d3ec', '#fff2b8', '#dcd6ff', '#cdeff0', '#ffd6d6']

function BlocksBoard({ seed, onSolved, done }: BoardProps) {
  const p: BlocksPuzzle = useMemo(() => makeBlocks(seed), [seed])
  const n = p.size
  const [rects, setRects] = useState<Rect[]>([])
  const [corner, setCorner] = useState<Cell | null>(null)
  const owner = new Map<Cell, number>()
  rects.forEach((q, k) => rectCells(q, n).forEach((c) => owner.set(c, k)))
  const tap = (i: Cell) => {
    if (done) return
    if (corner === null) {
      const k = owner.get(i)
      if (k !== undefined) return setRects(rects.filter((_, x) => x !== k))
      return setCorner(i)
    }
    const [r1, c1, r2, c2] = [Math.floor(corner / n), corner % n, Math.floor(i / n), i % n]
    const q = { r: Math.min(r1, r2), c: Math.min(c1, c2), h: Math.abs(r1 - r2) + 1, w: Math.abs(c1 - c2) + 1 }
    const cells = new Set(rectCells(q, n))
    const next = [...rects.filter((x) => !rectCells(x, n).some((c) => cells.has(c))), q]
    setRects(next)
    setCorner(null)
    if (blocksSolved(p, next)) setTimeout(onSolved, 0)
  }
  const line = (i: Cell, j: Cell | null) => (j !== null && owner.get(i) !== undefined && owner.get(i) === owner.get(j) ? '1px solid transparent' : '1px solid var(--border)')
  return (
    <>
      <div className="logic-board blocks-board" style={gridStyle(n)} role="grid" aria-label="Blocks">
        {Array.from({ length: n * n }, (_, i) => {
          const [r, c] = [Math.floor(i / n), i % n]
          const k = owner.get(i)
          return (
            <button
              key={i}
              type="button"
              className={`logic-cell${corner === i ? ' corner' : ''}`}
              onClick={() => tap(i)}
              style={{
                background: k !== undefined ? BLOCK_COLORS[k % BLOCK_COLORS.length] : undefined,
                borderTop: line(i, r > 0 ? i - n : null),
                borderBottom: line(i, r < n - 1 ? i + n : null),
                borderLeft: line(i, c > 0 ? i - 1 : null),
                borderRight: line(i, c < n - 1 ? i + 1 : null),
              }}
              aria-label={p.clues[i] !== undefined ? `Number ${p.clues[i]}` : 'Square'}
            >
              {p.clues[i] ?? ''}
            </button>
          )
        })}
      </div>
      <p className="muted small">{corner !== null ? 'Now tap the opposite corner.' : 'Tap a corner to start a rectangle.'}</p>
    </>
  )
}

// ---- Sum Up ----

function CombineBoard({ seed, onSolved, done, size }: BoardProps & { size: number }) {
  const p = useMemo(() => makeCombine(seed, size), [seed, size])
  const n = p.size
  const [grid, setGrid] = useState<number[]>(p.grid)
  const [picked, setPicked] = useState<Cell | null>(null)
  const from = useRef<Cell | null>(null)
  const move = (a: Cell, b: Cell) => {
    const next = combineMove(grid, a, b, n)
    if (!next) return false
    setGrid(next)
    setPicked(null)
    if (combineSolved(next)) setTimeout(onSolved, 0)
    return true
  }
  const stuck = combineStuck(grid, n)
  return (
    <>
      <div
        className="logic-board combine-board"
        style={gridStyle(n)}
        role="grid"
        aria-label="Sum Up"
        onPointerDown={(e) => {
          if (done) return
          ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
          from.current = cellAt(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => {
          // A swipe: moving onto a neighbor combines with it, once.
          const a = from.current
          const b = cellAt(e.clientX, e.clientY)
          if (a === null || b === null || a === b) return
          from.current = null
          move(a, b)
        }}
        onPointerUp={(e) => {
          // A tap (no swipe): pick a square, then tap a neighbor to combine.
          const a = from.current
          from.current = null
          const c = cellAt(e.clientX, e.clientY)
          if (a === null || c === null || a !== c || done || !grid[c]) return
          if (picked === null || picked === c) return setPicked(picked === c ? null : c)
          if (!move(picked, c)) setPicked(c)
        }}
      >
        {grid.map((v, i) => (
          <div key={i} data-cell={i} className={`logic-cell combine-cell${v ? '' : ' empty'}${picked === i ? ' picked' : ''}`} data-value={v || undefined}>
            {v || ''}
          </div>
        ))}
      </div>
      <p className="muted small">{stuck ? 'No moves left: Start over to try again.' : (() => {
          const left = grid.filter((v) => v).length
          return left === 1 ? 'Down to one square!' : `${left} squares left`
        })()}</p>
    </>
  )
}
