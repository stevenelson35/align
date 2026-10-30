import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { canSwap, newGame, play, type Game, type Gem } from '../../utils/match3'
import { celebrate } from '../../utils/celebrate'
import { IcePicture } from './IcePicture'

const COLORS = 5
const STORE = 'align-reveal-board'
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** This device's board for a reveal, kept between visits. */
function loadGame(key: string, cols: number, rows: number): Game {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? 'null') as { key: string; game: Game } | null
    if (saved?.key === key && saved.game.cells.length === cols * rows && saved.game.cells.every(Boolean)) return saved.game
  } catch {
    // a fresh board below
  }
  return newGame(cols, rows, COLORS, Math.random)
}

/** Five gems, each its own shape as well as color (easy to tell apart, color-blind or not). */
function GemShape({ gem }: { gem: Gem }) {
  if (gem.special === 'color')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {/* A wheel of all five colors: it clears every gem of the color it's swapped with. */}
        {[0, 1, 2, 3, 4].map((k) => (
          <circle key={k} cx="12" cy="12" r="5" fill="none" strokeWidth="10" className={`gem-wheel c${k}`} strokeDasharray={`${(2 * Math.PI * 5) / 5} ${2 * Math.PI * 5}`} strokeDashoffset={(-k * 2 * Math.PI * 5) / 5} />
        ))}
        <circle cx="12" cy="12" r="10" fill="none" stroke="white" strokeWidth="1.5" />
        <circle cx="9" cy="9" r="2.2" fill="white" opacity="0.75" />
      </svg>
    )
  const shapes = [
    <circle key="0" cx="12" cy="12" r="8.5" />,
    <path key="1" d="M12 2.5l8 9.5-8 9.5-8-9.5z" />,
    <path key="2" d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z" />,
    <path key="3" d="M12 3l2.6 5.8 6.3.6-4.8 4.2 1.4 6.2L12 16.6l-5.5 3.2 1.4-6.2-4.8-4.2 6.3-.6z" />,
    <rect key="4" x="4" y="4" width="16" height="16" rx="4" />,
  ]
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <g className={`gem-fill c${gem.color}`}>{shapes[gem.color]}</g>
      {gem.special === 'row' && <path d="M4 10h16M4 14h16" className="gem-stripe" />}
      {gem.special === 'col' && <path d="M10 4v16M14 4v16" className="gem-stripe" />}
      {gem.special === 'bomb' && <circle cx="12" cy="12" r="10.5" className="gem-ring" />}
      <ellipse cx="9.5" cy="8.5" rx="3" ry="1.8" fill="white" opacity="0.45" />
    </svg>
  )
}

/**
 * The reveal's match-3 board, laid on the hidden photo. Swipe a gem toward a neighbor (or tap one, then a neighbor)
 * to swap them; lines of 3+ burst, the gems above fall with a little bounce and new ones drop in, and chains keep
 * going. The squares under the gems are the photo's ice (deeper frost for thicker ice, cracked once hit); each burst
 * on one takes a layer (`onHits`, as it happens), and a broken square stays clear, showing that bit of the photo
 * around the gems that fall onto it. One move per swap (`onMoveDone` with every burst).
 */
export function RevealBoard({
  boardKey,
  cols,
  rows,
  photoId,
  left,
  thick,
  breaking,
  peek,
  movesLeft,
  onHits,
  onMoveDone,
}: {
  /** The reveal this board belongs to (a new reveal deals a new board). */
  boardKey: string
  /** The hidden photo: the board sits on it. */
  photoId: string
  /** Cells a move is hitting right now (their ice flashes or shatters). */
  breaking: Set<number>
  /** Fade the gems to look at the picture. */
  peek: boolean
  cols: number
  rows: number
  /** Hits each cell's ice still needs (0 = clear), and how thick it started. */
  left: number[]
  thick: number
  movesLeft: number
  /** Cells a burst hits, as it happens (for the ice to flash and break). */
  onHits: (cells: number[]) => void
  /** Every burst of the move, a cell once per time it burst. */
  onMoveDone: (bursts: number[]) => void
}) {
  const [first] = useState(() => ({ key: boardKey, game: loadGame(boardKey, cols, rows) }))
  const game = useRef<Game>(first.game)
  const dealtFor = useRef(first.key)
  const [cells, setCells] = useState<(Gem | null)[]>(() => first.game.cells.slice())
  const [popping, setPopping] = useState<Set<number>>(new Set())
  const [dropFrom, setDropFrom] = useState<Map<number, number>>(new Map())
  const [made, setMade] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<number | null>(null)
  const [nope, setNope] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const boardEl = useRef<HTMLDivElement>(null)
  const drag = useRef<{ i: number; x: number; y: number } | null>(null)

  // A new reveal deals a new board.
  useEffect(() => {
    if (dealtFor.current === boardKey) return
    dealtFor.current = boardKey
    game.current = loadGame(boardKey, cols, rows)
    setCells(game.current.cells.slice())
  }, [boardKey, cols, rows])

  const save = () => localStorage.setItem(STORE, JSON.stringify({ key: boardKey, game: game.current }))
  const centerOf = (list: number[]) => {
    const r = boardEl.current?.getBoundingClientRect()
    if (!r || !list.length) return {}
    const cx = list.reduce((s, i) => s + (i % cols) + 0.5, 0) / list.length
    const cy = list.reduce((s, i) => s + Math.floor(i / cols) + 0.5, 0) / list.length
    return { x: r.left + (cx / cols) * r.width, y: r.top + (cy / rows) * r.height }
  }

  async function swap(a: number, b: number) {
    if (busy || movesLeft <= 0) return
    setSelected(null)
    const g = game.current
    if (!canSwap(g, a, b)) {
      // Not a move: a little shake, nothing spent.
      setNope(new Set([a, b]))
      await wait(320)
      setNope(new Set())
      return
    }
    setBusy(true)
    const swapped = g.cells.slice()
    ;[swapped[a], swapped[b]] = [swapped[b], swapped[a]]
    setCells(swapped)
    await wait(still() ? 0 : 190)
    const result = play(g, a, b, Math.random)!
    let chain = 0
    let shown = swapped
    const bursts: number[] = []
    for (const step of result.steps) {
      if (step.shuffled) {
        setCells(step.after)
        shown = step.after
        await wait(still() ? 0 : 400)
        continue
      }
      chain++
      // Burst: the gems pop, sparkles fly (more for bigger bursts and longer chains), and the ice under them breaks.
      setPopping(new Set(step.burst.map((i) => shown[i]?.id).filter((x): x is number => x !== undefined)))
      celebrate({ done: 0, total: 0, ...centerOf(step.burst), small: { run: Math.max(1, Math.round(step.burst.length / 2) + chain - 1) } })
      const hit = [...step.burst, ...step.made.map((m) => m.at)]
      bursts.push(...hit)
      onHits(hit)
      await wait(still() ? 0 : 230)
      setPopping(new Set())
      setMade(new Set(step.made.map((m) => m.gem.id)))
      setCells(step.afterBurst)
      await wait(still() ? 0 : 60)
      // Fall: what's above drops into the gaps (bouncing a little), new gems drop in from above the board.
      setDropFrom(new Map(step.dropped.map((d) => [d.id, d.from])))
      setCells(step.after)
      await wait(still() ? 0 : 360)
      setDropFrom(new Map())
      shown = step.after
    }
    setMade(new Set())
    setCells(g.cells.slice())
    save()
    setBusy(false)
    onMoveDone(bursts)
  }

  const onDown = (i: number, e: React.PointerEvent) => {
    drag.current = { i, x: e.clientX, y: e.clientY }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 16) return
    drag.current = null
    const c = d.i % cols
    const r = Math.floor(d.i / cols)
    const to = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? (c < cols - 1 ? d.i + 1 : -1) : c > 0 ? d.i - 1 : -1) : dy > 0 ? (r < rows - 1 ? d.i + cols : -1) : r > 0 ? d.i - cols : -1
    if (to >= 0) void swap(d.i, to)
  }
  const onUp = (i: number) => {
    if (!drag.current) return
    drag.current = null
    // A tap: pick this gem, or swap with the one picked if they're neighbors.
    if (selected === null) setSelected(i)
    else if (selected === i) setSelected(null)
    else if (Math.abs((selected % cols) - (i % cols)) + Math.abs(Math.floor(selected / cols) - Math.floor(i / cols)) === 1) void swap(selected, i)
    else setSelected(i)
  }

  return (
    <div
      ref={boardEl}
      className={`reveal-board${movesLeft <= 0 ? ' out' : ''}${peek ? ' peek' : ''}`}
      style={{ aspectRatio: `${cols} / ${rows}`, '--cols': cols, '--rows': rows } as CSSProperties}
      onPointerMove={onMove}
      onPointerLeave={() => (drag.current = null)}
      role="grid"
      aria-label="Game board: swipe a gem toward a neighbor to swap them"
    >
      <IcePicture photoId={photoId} cols={cols} rows={rows} left={left} thick={thick} breaking={breaking} className="board-picture" />
      {cells.map((gem, i) =>
        gem ? (
          <button
            key={gem.id}
            type="button"
            className={['gem', popping.has(gem.id) && 'popping', dropFrom.has(gem.id) && 'dropping', made.has(gem.id) && 'made', selected === i && 'selected', nope.has(i) && 'nope'].filter(Boolean).join(' ')}
            style={{ '--c': i % cols, '--r': Math.floor(i / cols), '--from': dropFrom.get(gem.id) ?? 0 } as CSSProperties}
            onPointerDown={(e) => onDown(i, e)}
            onPointerUp={() => onUp(i)}
            aria-label={`${['Red circle', 'Blue diamond', 'Green hexagon', 'Gold star', 'Purple square'][gem.color]}${gem.special ? ` (${gem.special === 'color' ? 'rainbow' : gem.special === 'bomb' ? 'bomb' : gem.special === 'row' ? 'clears its row' : 'clears its column'})` : ''}`}
            disabled={busy || movesLeft <= 0}
          >
            <GemShape gem={gem} />
          </button>
        ) : null,
      )}
    </div>
  )
}
