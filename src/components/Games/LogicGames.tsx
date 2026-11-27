import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type Ref } from 'react'
import { today } from '../../engine/dates'
import { recordGameScore, useGameScores } from '../../firebase/games'
import { earnDaily } from '../../firebase/play'
import { compareGameResults, dailyAfter, gameById, type GameId } from '../../games/catalog'
import {
  balanceConflicts,
  balanceHint,
  blocksHint,
  combineHint,
  starsHint,
  trailHint,
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
import { FamilyResults } from './FamilyResults'
import { useDailyDone } from '../../hooks/useDailyDone'
import { GameExample } from './GameExample'


const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

const RULES: Record<LogicGameId, string> = {
  trail: 'Draw one path from 1 that passes every number in order and fills every square. Drag from 1 (or tap the next square); drag back, or tap an earlier square, to undo.',
  balance: 'Fill every square with ● or ○ (tap to change). Each row and column has three of each; never three of one side by side; = means the two squares match, × means they differ.',
  stars: 'Put one ★ in every row, every column and every colored area. Stars can’t touch, not even corner to corner. Tap once for × (a note), twice for ★.',
  combine: 'Swipe a square onto a neighbor with the same number (or tap one, then the other): they become one square holding the sum. Combine them all into one. Bigger grids are harder.',
  blocks: 'Cut the grid into rectangles. Each rectangle holds exactly one number, and the number is how many squares it covers. Tap two corners to make one; tap a rectangle to remove it.',
}

/** Remembered on this device for today's puzzle: when you started it and the hints you've taken (so leaving and coming back keeps the clock). */
const startKey = (id: string, seed: string) => `align-daily-start:${id}:${seed}`
const readStart = (id: string, seed: string): { at: number; hints: number } | null => {
  try {
    const v = JSON.parse(localStorage.getItem(startKey(id, seed)) ?? 'null') as { at: number; hints: number } | null
    return v && typeof v.at === 'number' ? v : null
  } catch {
    return null
  }
}

/** What a board does when you ask for a hint: one correct step (false: nothing left to show). */
export interface HintHandle {
  hint: () => boolean
}

/**
 * The daily logic puzzles (Trail, Balance, Star Fields, Blocks, Sum Up): the same puzzle for everyone each day, timed,
 * one go each (the clock runs from Start, even across Start over and coming back later). Hints show one correct step
 * each; the family results rank fewest hints first, then time. Finished: the next daily game, or a practice puzzle
 * (a new board, not on the results). Solving earns Glider play time once a day.
 */
export function LogicGame({ id, daily = false, onBack }: { id: LogicGameId; daily?: boolean; onBack: () => void }) {
  const app = useApp()
  const day = today()
  const game = gameById(id)!
  // Sum Up comes in 3 × 3, 4 × 4 and 5 × 5 (each its own daily puzzle and times); the rest have one size.
  const [size, setSize] = useState(3)
  // A practice puzzle: its own random board, untimed for the results.
  const [practice, setPractice] = useState<number | null>(null)
  const seed = practice ?? daySeed(id === 'combine' ? `combine-${size}` : id, day)
  const scoreSeed = id === 'combine' ? `${day}-${size}` : day
  const [round, setRound] = useState(0)
  const [solvedMs, setSolvedMs] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [hints, setHints] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const startedAt = useRef(0)
  const boardRef = useRef<HintHandle | null>(null)
  // Nothing shows and the clock doesn't run until Start, so you can look ahead (or skip one) without it counting.
  const [started, setStarted] = useState(false)
  const { scores } = useGameScores(id as GameId, scoreSeed, app.canPlay)
  const mine = scores.find((s) => s.uid === app.uid)
  const dailyDone = useDailyDone()
  const ranked = [...scores].sort((a, b) => compareGameResults(id as GameId, a.best, b.best))

  function start() {
    // Today's puzzle keeps the time from your first Start (and its hints), wherever you left it.
    const saved = practice === null ? readStart(id, scoreSeed) : null
    startedAt.current = saved?.at ?? Date.now()
    if (practice === null && !saved) localStorage.setItem(startKey(id, scoreSeed), JSON.stringify({ at: startedAt.current, hints: 0 }))
    setHints(saved?.hints ?? 0)
    setElapsed(Date.now() - startedAt.current)
    setSolvedMs(null)
    setStarted(true)
  }

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
    if (!app.canPlay || practice !== null) {
      if (practice !== null) celebrate({ done: 1, total: 1, message: 'Solved!' })
      return
    }
    localStorage.setItem(`${startKey(id, scoreSeed)}:done`, '1')
    void earnDaily(app.uid, id, day).catch(() => undefined)
    const result = { ms, ...(hints ? { hints } : {}) }
    recordGameScore(app.uid, id as GameId, scoreSeed, result)
      .then(() => {
        const familyBest = !scores.length || compareGameResults(id as GameId, result, ranked[0].best) < 0
        celebrate({ done: 1, total: 1, message: familyBest ? 'Best in the family today!' : 'Solved!' })
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [solvedMs, app.canPlay, app.uid, id, day, scoreSeed, scores, ranked, practice, hints])

  function hint() {
    if (solvedMs !== null || !boardRef.current?.hint()) return
    const next = hints + 1
    setHints(next)
    if (practice === null) localStorage.setItem(startKey(id, scoreSeed), JSON.stringify({ at: startedAt.current, hints: next }))
  }

  /** Clear the board; today's clock keeps running (it's one go). */
  const clearBoard = () => setRound((r) => r + 1)

  function newPractice() {
    setPractice(Math.floor(Math.random() * 2 ** 31))
    setSolvedMs(null)
    setHints(0)
    setRound((r) => r + 1)
    startedAt.current = Date.now()
    setElapsed(0)
    setStarted(true)
  }

  const next = dailyAfter(id as GameId)
  const finishedActions = (
    <div className="row wrap logic-after">
      <button type="button" onClick={() => app.navigate({ view: 'games', gameId: next, daily: true })}>
        Next daily: {gameById(next)?.name} <Icon name="chevron-right" />
      </button>
      <button type="button" className="secondary" onClick={newPractice}>
        Practice puzzle
      </button>
    </div>
  )

  const board = (() => {
    const props = { key: `${round}-${size}-${seed}`, seed, onSolved: solved, done: solvedMs !== null, ref: boardRef }
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
  const resultText = (r: { ms?: number; hints?: number }) => `${clock(r.ms ?? 0)}${r.hints ? ` · ${r.hints} hint${r.hints === 1 ? '' : 's'}` : ''}`
  // Done today: your saved time, or (before that loads) this device's note and the day's play-time record.
  const doneHere = !!localStorage.getItem(`${startKey(id, scoreSeed)}:done`)
  const solvedToday = practice === null && (!!mine || doneHere || (id !== 'combine' && dailyDone.has(id)))

  return (
    <section className="games-view logic-game">
      <header className="view-header">
        <h2>
          <Icon name="sparkle" /> {game.name}
        </h2>
        <HelpTip topic={id} label={game.name} />
        <span className="muted small">{practice !== null ? 'A practice puzzle (not on today’s results).' : 'Today’s puzzle, the same for everyone.'}</span>
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
                setStarted(false)
                setSolvedMs(null)
                setRound((r) => r + 1)
              }}
            >
              <option value={3}>3 × 3</option>
              <option value={4}>4 × 4 (harder)</option>
              <option value={5}>5 × 5 (hardest)</option>
            </select>
          </label>
        )}
        {!started && solvedToday ? (
          <div className="logic-start">
            <p className="small">
              You’ve done today’s{mine ? `: ${resultText(mine.best)}` : ''}. A new one comes tomorrow.
            </p>
            {daily || practice === null ? finishedActions : null}
          </div>
        ) : !started ? (
          <div className="logic-start">
            <GameExample id={id} className="game-example-start" />
            <p className="small muted">{readStart(id, scoreSeed) ? 'You started this one earlier: the clock carries on from then.' : 'The board shows and the clock starts when you tap Start. One go a day: Start over clears the board, not the clock.'}</p>
            <button type="button" onClick={start}>
              <Icon name="play" /> Start
            </button>
          </div>
        ) : (
          <>
            <div className="game-status row" aria-live="polite">
              <strong>{clock(elapsed)}</strong>
              {hints > 0 && <span className="muted small">{hints} hint{hints === 1 ? '' : 's'}</span>}
              {solvedMs !== null && <span className="badge">Solved!</span>}
              <span className="grow" />
              {solvedMs === null && (
                <button type="button" className="secondary small" onClick={hint} title={practice !== null ? 'Show one correct step' : 'Show one correct step (fewest hints ranks first)'}>
                  Hint
                </button>
              )}
            </div>
            {board}
            {error && <p className="error small">{error}</p>}
            {solvedMs !== null ? (
              finishedActions
            ) : (
              <button type="button" className="secondary small" onClick={clearBoard}>
                Start over{practice === null ? ' (the clock keeps going)' : ''}
              </button>
            )}
          </>
        )}
      </article>
      <FamilyResults gameId={id} gameName={id === 'combine' ? `${game.name} (${size} × ${size})` : game.name} day={scoreSeed} rows={ranked.map((r) => ({ uid: r.uid, text: resultText(r.best) }))} />
    </section>
  )
}

interface BoardProps {
  seed: number
  onSolved: () => void
  done: boolean
  /** Hint: one correct step. */
  ref?: Ref<HintHandle>
}

/** The square under a finger or pointer, for dragging across the board. */
const cellAt = (x: number, y: number): Cell | null => {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-cell]')
  return el ? Number(el.dataset.cell) : null
}

const gridStyle = (n: number): CSSProperties => ({ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` })

// ---- Trail ----

function TrailBoard({ seed, onSolved, done, ref }: BoardProps) {
  const p: TrailPuzzle = useMemo(() => makeTrail(seed), [seed])
  const n = p.size
  const [path, setPath] = useState<Cell[]>([])
  useImperativeHandle(ref, () => ({
    hint: () => {
      const next = trailHint(p, path)
      if (next.join() === path.join()) return false
      setPath(next)
      if (trailSolved(p, next)) setTimeout(onSolved, 0)
      return true
    },
  }))
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

function BalanceBoard({ seed, onSolved, done, ref }: BoardProps) {
  const p: BalancePuzzle = useMemo(() => makeBalance(seed), [seed])
  const n = p.size
  const [grid, setGrid] = useState<(Mark | null)[]>(() => Array.from({ length: n * n }, (_, i) => p.given[i] ?? null))
  const bad = balanceConflicts(p, grid)
  useImperativeHandle(ref, () => ({
    hint: () => {
      const h = balanceHint(p, grid)
      if (!h) return false
      const next = grid.map((v, i) => (i === h.cell ? h.value : v))
      setGrid(next)
      if (balanceSolved(p, next)) setTimeout(onSolved, 0)
      return true
    },
  }))
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

function StarsBoard({ seed, onSolved, done, ref }: BoardProps) {
  const p: StarsPuzzle = useMemo(() => makeStars(seed), [seed])
  const n = p.size
  // 0 empty, 1 × (a note), 2 ★
  const [marks, setMarks] = useState<number[]>(() => Array(n * n).fill(0))
  const stars = new Set(marks.flatMap((m, i) => (m === 2 ? [i] : [])))
  const bad = starConflicts(p, stars)
  useImperativeHandle(ref, () => ({
    hint: () => {
      const h = starsHint(p, stars)
      if (!h) return false
      const next = marks.map((m, i) => (i === h.cell ? (h.star ? 2 : 0) : m))
      setMarks(next)
      if (starsSolved(p, new Set(next.flatMap((m, j) => (m === 2 ? [j] : []))))) setTimeout(onSolved, 0)
      return true
    },
  }))
  const tap = (i: Cell) => {
    if (done) return
    const next = [...marks]
    next[i] = (next[i] + 1) % 3
    setMarks(next)
    const s = new Set(next.flatMap((m, j) => (m === 2 ? [j] : [])))
    if (starsSolved(p, s)) setTimeout(onSolved, 0)
  }
  // The areas' outlines, drawn once over the board: one even line between two areas and around the edge.
  const outline = useMemo(() => {
    const segs: string[] = []
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const i = r * n + c
        if (c < n - 1 && p.regions[i] !== p.regions[i + 1]) segs.push(`M${c + 1} ${r}V${r + 1}`)
        if (r < n - 1 && p.regions[i] !== p.regions[i + n]) segs.push(`M${c} ${r + 1}H${c + 1}`)
      }
    return segs.join('')
  }, [p, n])
  return (
    <div className="logic-board stars-board" style={gridStyle(n)} role="grid" aria-label="Star Fields">
      {marks.map((m, i) => (
        <button
          key={i}
          type="button"
          className={`logic-cell${bad.has(i) ? ' bad' : ''}`}
          onClick={() => tap(i)}
          style={{ background: AREA_COLORS[p.regions[i] % AREA_COLORS.length] }}
          aria-label={m === 2 ? 'Star' : m === 1 ? 'Marked empty' : 'Empty'}
        >
          {m === 2 ? '★' : m === 1 ? '×' : ''}
        </button>
      ))}
      <svg className="stars-outline" viewBox={`0 0 ${n} ${n}`} preserveAspectRatio="none" aria-hidden="true">
        <path d={outline} />
        <rect x="0" y="0" width={n} height={n} />
      </svg>
    </div>
  )
}

// ---- Blocks ----

const BLOCK_COLORS = ['#cfe3ff', '#ffe0c2', '#d8f2d0', '#f6d3ec', '#fff2b8', '#dcd6ff', '#cdeff0', '#ffd6d6']

function BlocksBoard({ seed, onSolved, done, ref }: BoardProps) {
  const p: BlocksPuzzle = useMemo(() => makeBlocks(seed), [seed])
  const n = p.size
  const [rects, setRects] = useState<Rect[]>([])
  const [corner, setCorner] = useState<Cell | null>(null)
  const owner = new Map<Cell, number>()
  rects.forEach((q, k) => rectCells(q, n).forEach((c) => owner.set(c, k)))
  useImperativeHandle(ref, () => ({
    hint: () => {
      const q = blocksHint(p, rects)
      if (!q) return false
      const cells = new Set(rectCells(q, n))
      const next = [...rects.filter((x) => !rectCells(x, n).some((c) => cells.has(c))), q]
      setRects(next)
      setCorner(null)
      if (blocksSolved(p, next)) setTimeout(onSolved, 0)
      return true
    },
  }))
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

function CombineBoard({ seed, onSolved, done, size, ref }: BoardProps & { size: number }) {
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
  useImperativeHandle(ref, () => ({
    hint: () => {
      const m = combineHint(grid, n, p)
      return m ? move(m[0], m[1]) : false
    },
  }))
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
