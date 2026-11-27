// The daily logic puzzles (DESIGN.md §5.23): Trail, Balance, Star Fields and Blocks. Each day everyone gets the same
// puzzle (seeded by the game and the date). A puzzle is made from a solution, and a player's answer is checked by the
// rules, not against that solution, so any answer that follows the rules counts. Pure and unit-tested.
import { seeded } from '../utils/match3'

export type Cell = number // r * size + c

export const LOGIC_GAMES = ['trail', 'balance', 'stars', 'blocks', 'combine'] as const
export type LogicGameId = (typeof LOGIC_GAMES)[number]
export const isLogicGame = (id: string): id is LogicGameId => (LOGIC_GAMES as readonly string[]).includes(id)

/** A day's seed for a game: the same numbers for everyone that day. */
export function daySeed(game: string, day: string): number {
  let h = 2166136261
  for (const ch of `${game}:${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

const shuffle = <T,>(items: T[], rand: () => number) => {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const rc = (i: Cell, n: number) => [Math.floor(i / n), i % n] as const
export const neighbors = (i: Cell, n: number): Cell[] => {
  const [r, c] = rc(i, n)
  return [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ]
    .filter(([y, x]) => y >= 0 && y < n && x >= 0 && x < n)
    .map(([y, x]) => y * n + x)
}

// ---- Trail: one path through every square, from 1 through each number in order ----

export interface TrailPuzzle {
  size: number
  /** Cell → its number (1 is the start; the highest is the end). */
  numbers: Record<number, number>
  /** The path it was made from (one answer; others that follow the rules count too). */
  solution: Cell[]
}

/** A path through every square of an n × n grid (a random walk that backs up when stuck, choosing tight spots first). */
function hamiltonianPath(n: number, rand: () => number): Cell[] {
  const total = n * n
  for (;;) {
    const start = Math.floor(rand() * total)
    const path: Cell[] = [start]
    const seen = new Set<Cell>([start])
    let steps = 0
    const extend = (): boolean => {
      if (path.length === total) return true
      if (++steps > 20000) return false
      const here = path[path.length - 1]
      const free = (c: Cell) => neighbors(c, n).filter((x) => !seen.has(x)).length
      const next = shuffle(neighbors(here, n).filter((x) => !seen.has(x)), rand).sort((a, b) => free(a) - free(b))
      for (const c of next) {
        path.push(c)
        seen.add(c)
        if (extend()) return true
        path.pop()
        seen.delete(c)
      }
      return false
    }
    if (extend()) return path
  }
}

export function makeTrail(seed: number, n = 6): TrailPuzzle {
  const rand = seeded(seed)
  const path = hamiltonianPath(n, rand)
  // Numbers on the start, the end, and every few squares between (about 8 in all).
  const marks = [0]
  for (let i = 3 + Math.floor(rand() * 2); i < path.length - 2; i += 3 + Math.floor(rand() * 3)) marks.push(i)
  marks.push(path.length - 1)
  const numbers: Record<number, number> = {}
  marks.forEach((at, k) => (numbers[path[at]] = k + 1))
  return { size: n, numbers, solution: path }
}

/** A finished trail: every square once, each step to a neighbor, starting on 1 and meeting the numbers in order. */
export function trailSolved(p: TrailPuzzle, path: Cell[]): boolean {
  const n = p.size
  if (path.length !== n * n || new Set(path).size !== path.length) return false
  for (let i = 1; i < path.length; i++) if (!neighbors(path[i - 1], n).includes(path[i])) return false
  const seen = path.filter((c) => p.numbers[c] !== undefined).map((c) => p.numbers[c])
  return seen.every((v, i) => v === i + 1) && seen.length === Object.keys(p.numbers).length
}

/** Whether a partial trail is still on track (starts on 1, numbers in order so far). */
export function trailOnTrack(p: TrailPuzzle, path: Cell[]): boolean {
  if (!path.length) return true
  if (p.numbers[path[0]] !== 1) return false
  let want = 1
  for (const c of path) {
    const v = p.numbers[c]
    if (v === undefined) continue
    if (v !== want) return false
    want++
  }
  return true
}

// ---- Balance: fill the grid with ● and ○ ----
// Each row and column has as many of each; never three of one side by side; "=" between two squares means the same,
// "×" means different.

export type Mark = 0 | 1 // 0 = ●, 1 = ○
export interface BalanceEdge {
  a: Cell
  b: Cell
  same: boolean
}
export interface BalancePuzzle {
  size: number
  /** Cell → what's there from the start. */
  given: Record<number, Mark>
  edges: BalanceEdge[]
  solution: Mark[]
}

function balanceSolution(n: number, rand: () => number): Mark[] {
  const grid: (Mark | null)[] = Array(n * n).fill(null)
  const ok = (i: Cell, v: Mark) => {
    const [r, c] = rc(i, n)
    grid[i] = v
    const row = Array.from({ length: n }, (_, x) => grid[r * n + x])
    const col = Array.from({ length: n }, (_, y) => grid[y * n + c])
    const good = [row, col].every((line) => {
      if (line.filter((x) => x === v).length > n / 2) return false
      for (let k = 0; k + 2 < n; k++) if (line[k] !== null && line[k] === line[k + 1] && line[k] === line[k + 2]) return false
      return true
    })
    grid[i] = null
    return good
  }
  const fill = (i: number): boolean => {
    if (i === n * n) return true
    for (const v of shuffle([0, 1] as Mark[], rand)) {
      if (!ok(i, v)) continue
      grid[i] = v
      if (fill(i + 1)) return true
      grid[i] = null
    }
    return false
  }
  fill(0)
  return grid as Mark[]
}

export function makeBalance(seed: number, n = 6): BalancePuzzle {
  const rand = seeded(seed)
  const sol = balanceSolution(n, rand)
  const given: Record<number, Mark> = {}
  for (const i of shuffle([...Array(n * n).keys()], rand).slice(0, 8)) given[i] = sol[i]
  const pairs: [Cell, Cell][] = []
  for (let i = 0; i < n * n; i++) for (const j of neighbors(i, n)) if (j > i) pairs.push([i, j])
  const edges = shuffle(pairs, rand)
    .filter(([a, b]) => given[a] === undefined || given[b] === undefined)
    .slice(0, 7)
    .map(([a, b]) => ({ a, b, same: sol[a] === sol[b] }))
  return { size: n, given, edges, solution: sol }
}

/** The squares breaking a rule right now (three in a row, too many of one in a line, a wrong = or ×). */
export function balanceConflicts(p: BalancePuzzle, grid: (Mark | null)[]): Set<Cell> {
  const n = p.size
  const bad = new Set<Cell>()
  const lines: Cell[][] = []
  for (let r = 0; r < n; r++) lines.push(Array.from({ length: n }, (_, c) => r * n + c))
  for (let c = 0; c < n; c++) lines.push(Array.from({ length: n }, (_, r) => r * n + c))
  for (const line of lines) {
    for (const v of [0, 1] as Mark[]) if (line.filter((i) => grid[i] === v).length > n / 2) line.filter((i) => grid[i] === v).forEach((i) => bad.add(i))
    for (let k = 0; k + 2 < n; k++) {
      const [a, b, c] = [line[k], line[k + 1], line[k + 2]]
      if (grid[a] !== null && grid[a] === grid[b] && grid[a] === grid[c]) [a, b, c].forEach((i) => bad.add(i))
    }
  }
  for (const e of p.edges) {
    if (grid[e.a] === null || grid[e.b] === null) continue
    if ((grid[e.a] === grid[e.b]) !== e.same) [e.a, e.b].forEach((i) => bad.add(i))
  }
  return bad
}

export const balanceSolved = (p: BalancePuzzle, grid: (Mark | null)[]) =>
  grid.length === p.size * p.size && grid.every((v, i) => v !== null && (p.given[i] === undefined || p.given[i] === v)) && balanceConflicts(p, grid).size === 0

// ---- Star Fields: one star in every row, column and colored area; no two stars touch, even corner to corner ----

export interface StarsPuzzle {
  size: number
  /** Cell → its area (0 … size − 1). */
  regions: number[]
  solution: Cell[]
}

export function makeStars(seed: number, n = 7): StarsPuzzle {
  const rand = seeded(seed)
  // Stars: a column for each row, none next to the row above (so none touch).
  const cols: number[] = []
  const place = (r: number): boolean => {
    if (r === n) return true
    for (const c of shuffle([...Array(n).keys()], rand)) {
      if (cols.includes(c) || (r > 0 && Math.abs(cols[r - 1] - c) <= 1)) continue
      cols.push(c)
      if (place(r + 1)) return true
      cols.pop()
    }
    return false
  }
  place(0)
  // Areas: grown out from each star, a square at a time, until they fill the grid.
  const regions = Array(n * n).fill(-1)
  cols.forEach((c, r) => (regions[r * n + c] = r))
  let open = n * n - n
  while (open > 0) {
    const r = Math.floor(rand() * n)
    const edge = regions.flatMap((g, i) => (g === r ? neighbors(i, n).filter((j) => regions[j] === -1) : []))
    if (!edge.length) continue
    regions[edge[Math.floor(rand() * edge.length)]] = r
    open--
  }
  return { size: n, regions, solution: cols.map((c, r) => r * n + c) }
}

/** The stars breaking a rule (sharing a row, column or area with another, or touching one). */
export function starConflicts(p: StarsPuzzle, stars: Set<Cell>): Set<Cell> {
  const n = p.size
  const bad = new Set<Cell>()
  const list = [...stars]
  for (let x = 0; x < list.length; x++)
    for (let y = x + 1; y < list.length; y++) {
      const [ra, ca] = rc(list[x], n)
      const [rb, cb] = rc(list[y], n)
      if (ra === rb || ca === cb || p.regions[list[x]] === p.regions[list[y]] || (Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1)) {
        bad.add(list[x])
        bad.add(list[y])
      }
    }
  return bad
}

export const starsSolved = (p: StarsPuzzle, stars: Set<Cell>) => stars.size === p.size && starConflicts(p, stars).size === 0

// ---- Blocks: cut the grid into rectangles, each holding exactly one number, its size ----

export interface Rect {
  r: number
  c: number
  h: number
  w: number
}
export interface BlocksPuzzle {
  size: number
  /** Cell → the size of its rectangle. */
  clues: Record<number, number>
  solution: Rect[]
}

export const rectCells = (q: Rect, n: number): Cell[] => {
  const out: Cell[] = []
  for (let y = q.r; y < q.r + q.h; y++) for (let x = q.c; x < q.c + q.w; x++) out.push(y * n + x)
  return out
}

export function makeBlocks(seed: number, n = 6): BlocksPuzzle {
  const rand = seeded(seed)
  const taken = Array(n * n).fill(false)
  const clues: Record<number, number> = {}
  const solution: Rect[] = []
  for (let i = 0; i < n * n; i++) {
    if (taken[i]) continue
    const [r, c] = rc(i, n)
    // Every rectangle that starts here and fits the free space, 2 to 8 squares (a single square only if nothing fits).
    const options: Rect[] = []
    for (let h = 1; r + h <= n; h++)
      for (let w = 1; c + w <= n; w++) {
        const q = { r, c, h, w }
        if (h * w > 8 || rectCells(q, n).some((x) => taken[x])) continue
        if (h * w >= 2) options.push(q)
      }
    const q = options.length ? options[Math.floor(rand() * options.length)] : { r, c, h: 1, w: 1 }
    const cells = rectCells(q, n)
    cells.forEach((x) => (taken[x] = true))
    solution.push(q)
    clues[cells[Math.floor(rand() * cells.length)]] = cells.length
  }
  return { size: n, clues, solution }
}

/** A finished cut: rectangles cover every square once, each with exactly one number, equal to its size. */
export function blocksSolved(p: BlocksPuzzle, rects: Rect[]): boolean {
  const n = p.size
  const count = Array(n * n).fill(0)
  for (const q of rects) {
    const cells = rectCells(q, n)
    const nums = cells.filter((x) => p.clues[x] !== undefined)
    if (nums.length !== 1 || p.clues[nums[0]] !== cells.length) return false
    cells.forEach((x) => count[x]++)
  }
  return count.every((k) => k === 1)
}

// ---- Sum Up: swipe a square onto a neighbor with the same number; they become one square holding the sum ----
// Made backwards from a single number, split in halves into neighboring squares until the grid is full, so it can
// always be finished (undo the splits in reverse). Bigger grids are harder.

export interface CombinePuzzle {
  size: number
  /** Cell → its number (every square starts full). */
  grid: number[]
  /** One way to finish: [from, to] moves. */
  solution: [Cell, Cell][]
}

export function makeCombine(seed: number, n = 3): CombinePuzzle {
  const rand = seeded(seed)
  const start = n === 3 ? 32 : n === 4 ? 64 : 128
  for (;;) {
    const grid: number[] = Array(n * n).fill(0)
    grid[Math.floor(rand() * n * n)] = start
    const splits: [Cell, Cell][] = [] // [stays, new]
    let filled = 1
    while (filled < n * n) {
      const options: [Cell, Cell][] = []
      grid.forEach((v, i) => {
        if (v >= 2) for (const j of neighbors(i, n)) if (!grid[j]) options.push([i, j])
      })
      if (!options.length) break
      const [i, j] = options[Math.floor(rand() * options.length)]
      grid[i] /= 2
      grid[j] = grid[i]
      splits.push([i, j])
      filled++
    }
    if (filled === n * n) return { size: n, grid, solution: splits.reverse().map(([stay, moved]) => [moved, stay]) }
  }
}

/** Moving the square at `from` onto its neighbor `to`: both the same number → `to` holds the sum, `from` empties. */
export function combineMove(grid: number[], from: Cell, to: Cell, n: number): number[] | null {
  if (!grid[from] || grid[from] !== grid[to] || !neighbors(from, n).includes(to)) return null
  const next = [...grid]
  next[to] = grid[from] + grid[to]
  next[from] = 0
  return next
}

export const combineSolved = (grid: number[]) => grid.filter((v) => v > 0).length === 1

/** Whether any move is left (when none and more than one square remains, start over). */
export const combineStuck = (grid: number[], n: number) =>
  !combineSolved(grid) && !grid.some((v, i) => v > 0 && neighbors(i, n).some((j) => grid[j] === v))
