// The reveal game (DESIGN.md §5.6, goal rewards): a match-3 board. Swap two neighbors to line up 3 or more of a
// color; they burst, the gems above fall, new ones drop in, and matches made by the fall burst too. Every cell that
// bursts breaks the ice over the same spot of the hidden picture. Pure and seeded, so it's unit-tested; the
// component only animates the steps.

/** Made by bigger matches: 4 in a line clears a whole row or column, an L / T shape blasts 3×3 around it, 5 in a
 *  line clears every gem of one color. A special goes off when it bursts, or when it's swapped. */
export type Special = 'row' | 'col' | 'bomb' | 'color'

export interface Gem {
  /** Stays with the gem as it moves, so the board can animate it. */
  id: number
  color: number
  special?: Special
}

export interface Game {
  cols: number
  rows: number
  colors: number
  cells: (Gem | null)[]
  nextId: number
}

/** One beat of a move, for the animation: what burst (and where new specials appeared), then the board after the
 *  fall and refill. `dropped` are the new gems, with how many rows above the board each starts. */
export interface Step {
  burst: number[]
  made: { at: number; gem: Gem }[]
  afterBurst: (Gem | null)[]
  after: (Gem | null)[]
  dropped: { id: number; from: number }[]
  shuffled?: boolean
}

/** A seeded random number generator (mulberry32), so a board can be replayed in tests. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const at = (g: Pick<Game, 'cols'>, r: number, c: number) => r * g.cols + c
export const rowOf = (g: Pick<Game, 'cols'>, i: number) => Math.floor(i / g.cols)
export const colOf = (g: Pick<Game, 'cols'>, i: number) => i % g.cols

export function adjacent(g: Pick<Game, 'cols'>, a: number, b: number): boolean {
  const dr = Math.abs(rowOf(g, a) - rowOf(g, b))
  const dc = Math.abs(colOf(g, a) - colOf(g, b))
  return dr + dc === 1
}

/** A new board with no matches already on it and at least one move. */
export function newGame(cols: number, rows: number, colors: number, rand: () => number): Game {
  const g: Game = { cols, rows, colors, cells: [], nextId: 1 }
  do {
    g.cells = []
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        let color: number
        do color = Math.floor(rand() * colors)
        while (
          (c >= 2 && g.cells[at(g, r, c - 1)]?.color === color && g.cells[at(g, r, c - 2)]?.color === color) ||
          (r >= 2 && g.cells[at(g, r - 1, c)]?.color === color && g.cells[at(g, r - 2, c)]?.color === color)
        )
        g.cells.push({ id: g.nextId++, color })
      }
  } while (!hasMove(g))
  return g
}

interface Group {
  cells: number[]
  /** The longest straight run in it, and whether it has runs both ways (an L or T). */
  longest: number
  dir: 'h' | 'v'
  cross: boolean
}

/** Lines of 3 or more of a color, joined where they share a gem (an L or T is one group). Specials match by color. */
export function findGroups(g: Pick<Game, 'cols' | 'rows' | 'cells'>): Group[] {
  const runs: { cells: number[]; dir: 'h' | 'v' }[] = []
  const color = (i: number) => g.cells[i]?.color
  for (let r = 0; r < g.rows; r++) {
    let start = 0
    for (let c = 1; c <= g.cols; c++) {
      if (c < g.cols && color(at(g, r, c)) !== undefined && color(at(g, r, c)) === color(at(g, r, start))) continue
      if (c - start >= 3 && color(at(g, r, start)) !== undefined) runs.push({ cells: Array.from({ length: c - start }, (_, k) => at(g, r, start + k)), dir: 'h' })
      start = c
    }
  }
  for (let c = 0; c < g.cols; c++) {
    let start = 0
    for (let r = 1; r <= g.rows; r++) {
      if (r < g.rows && color(at(g, r, c)) !== undefined && color(at(g, r, c)) === color(at(g, start, c))) continue
      if (r - start >= 3 && color(at(g, start, c)) !== undefined) runs.push({ cells: Array.from({ length: r - start }, (_, k) => at(g, start + k, c)), dir: 'v' })
      start = r
    }
  }
  // Join runs that share a cell.
  const groups: { runs: typeof runs }[] = []
  for (const run of runs) {
    const touching = groups.filter((gr) => gr.runs.some((x) => x.cells.some((i) => run.cells.includes(i))))
    const merged = { runs: [run, ...touching.flatMap((t) => t.runs)] }
    for (const t of touching) groups.splice(groups.indexOf(t), 1)
    groups.push(merged)
  }
  return groups.map((gr) => {
    const longestRun = gr.runs.reduce((a, b) => (b.cells.length > a.cells.length ? b : a))
    return {
      cells: [...new Set(gr.runs.flatMap((x) => x.cells))],
      longest: longestRun.cells.length,
      dir: longestRun.dir,
      cross: gr.runs.some((x) => x.dir === 'h') && gr.runs.some((x) => x.dir === 'v'),
    }
  })
}

/** The special a group makes, if any. */
function specialFor(group: Group): Special | undefined {
  if (group.longest >= 5) return 'color'
  if (group.cross) return 'bomb'
  if (group.longest === 4) return group.dir === 'h' ? 'col' : 'row'
  return undefined
}

/** The cells a special clears when it goes off at `i` (a color special takes `target`'s color). */
function blast(g: Game, i: number, special: Special, target?: number): number[] {
  const r = rowOf(g, i)
  const c = colOf(g, i)
  if (special === 'row') return Array.from({ length: g.cols }, (_, k) => at(g, r, k))
  if (special === 'col') return Array.from({ length: g.rows }, (_, k) => at(g, k, c))
  if (special === 'bomb') {
    const out: number[] = []
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) if (r + dr >= 0 && r + dr < g.rows && c + dc >= 0 && c + dc < g.cols) out.push(at(g, r + dr, c + dc))
    return out
  }
  const color = target ?? mostCommonColor(g)
  return [i, ...g.cells.flatMap((x, k) => (x && x.color === color ? [k] : []))]
}

function mostCommonColor(g: Game): number {
  const n = new Array(g.colors).fill(0)
  for (const x of g.cells) if (x) n[x.color]++
  return n.indexOf(Math.max(...n))
}

/** Bursts these cells, setting off any specials among them (and any those hit), until nothing more goes off. */
function burstWithSpecials(g: Game, start: number[], keep: Set<number>, targets: Map<number, number> = new Map()): number[] {
  const out = new Set<number>()
  const queue = [...start]
  while (queue.length) {
    const i = queue.pop()!
    if (out.has(i) || keep.has(i) || !g.cells[i]) continue
    out.add(i)
    const s = g.cells[i]!.special
    if (s) for (const j of blast(g, i, s, targets.get(i))) if (!out.has(j)) queue.push(j)
  }
  return [...out]
}

/** Drops gems into the gaps and fills the top with new ones. */
function fall(g: Game, rand: () => number): { id: number; from: number }[] {
  const dropped: { id: number; from: number }[] = []
  for (let c = 0; c < g.cols; c++) {
    const column: Gem[] = []
    for (let r = g.rows - 1; r >= 0; r--) {
      const x = g.cells[at(g, r, c)]
      if (x) column.push(x)
    }
    const missing = g.rows - column.length
    for (let k = 0; k < missing; k++) {
      const gem = { id: g.nextId++, color: Math.floor(rand() * g.colors) }
      column.push(gem)
      dropped.push({ id: gem.id, from: missing })
    }
    for (let r = g.rows - 1, k = 0; r >= 0; r--, k++) g.cells[at(g, r, c)] = column[k]
  }
  return dropped
}

/** Whether any swap of neighbors makes a match (or sets off a special). */
export function hasMove(g: Game): boolean {
  if (g.cells.some((x) => x?.special)) return true
  for (let i = 0; i < g.cells.length; i++)
    for (const j of [i + 1, i + g.cols])
      if (j < g.cells.length && adjacent(g, i, j)) {
        const cells = g.cells.slice()
        ;[cells[i], cells[j]] = [cells[j], cells[i]]
        if (findGroups({ ...g, cells }).length) return true
      }
  return false
}

/** Whether swapping a and b is a move: neighbors that line something up, or a special swapped. */
export function canSwap(g: Game, a: number, b: number): boolean {
  if (!adjacent(g, a, b) || !g.cells[a] || !g.cells[b]) return false
  if (g.cells[a]!.special || g.cells[b]!.special) return true
  const cells = g.cells.slice()
  ;[cells[a], cells[b]] = [cells[b], cells[a]]
  return findGroups({ ...g, cells }).length > 0
}

/**
 * Plays a swap: the steps to animate (one per burst-and-fall, chains included), and every cell that burst along
 * the way (the ice it breaks). Null if it isn't a move. Changes `g` to the board afterwards.
 */
export function play(g: Game, a: number, b: number, rand: () => number): { steps: Step[]; hits: number[] } | null {
  if (!canSwap(g, a, b)) return null
  ;[g.cells[a], g.cells[b]] = [g.cells[b], g.cells[a]]
  const steps: Step[] = []
  const hits = new Set<number>()
  // A swapped special goes off where it lands (a color special takes the other gem's color).
  let pending: { cells: number[]; targets: Map<number, number>; made: { at: number; gem: Gem }[]; keep: Set<number> } | null = null
  const swappedSpecials = [b, a].filter((i) => g.cells[i]?.special)
  if (swappedSpecials.length) {
    const targets = new Map<number, number>()
    for (const i of swappedSpecials) if (g.cells[i]!.special === 'color') targets.set(i, g.cells[i === a ? b : a]!.color)
    pending = { cells: swappedSpecials, targets, made: [], keep: new Set() }
  }
  for (let guard = 0; guard < 50; guard++) {
    if (!pending) {
      const groups = findGroups(g)
      if (!groups.length) break
      const made: { at: number; gem: Gem }[] = []
      const keep = new Set<number>()
      for (const group of groups) {
        const s = specialFor(group)
        if (!s) continue
        // The new special sits where you swapped, if that's in the group; else in its middle.
        const spot = guard === 0 && group.cells.includes(b) ? b : guard === 0 && group.cells.includes(a) ? a : group.cells[Math.floor(group.cells.length / 2)]
        const gem = { id: g.nextId++, color: g.cells[spot]!.color, special: s }
        made.push({ at: spot, gem })
        keep.add(spot)
      }
      pending = { cells: groups.flatMap((gr) => gr.cells), targets: new Map(), made, keep }
    }
    const burst = burstWithSpecials(g, pending.cells, pending.keep, pending.targets)
    for (const i of burst) {
      hits.add(i)
      g.cells[i] = null
    }
    for (const m of pending.made) {
      hits.add(m.at)
      g.cells[m.at] = m.gem
    }
    const afterBurst = g.cells.slice()
    const dropped = fall(g, rand)
    steps.push({ burst, made: pending.made, afterBurst, after: g.cells.slice(), dropped })
    pending = null
  }
  // No moves left: mix the board (keeping its gems) until there's a move and nothing already lined up.
  if (!hasMove(g)) {
    for (let tries = 0; tries < 200 && (tries === 0 || findGroups(g).length || !hasMove(g)); tries++)
      for (let i = g.cells.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[g.cells[i], g.cells[j]] = [g.cells[j], g.cells[i]]
      }
    steps.push({ burst: [], made: [], afterBurst: g.cells.slice(), after: g.cells.slice(), dropped: [], shuffled: true })
  }
  return { steps, hits: [...hits].sort((x, y) => x - y) }
}

/** A board made from a picture of colors, for tests: rows of digits ("0120…"), '.' for empty. */
export function boardFrom(rows: string[], colors = 5): Game {
  const g: Game = { cols: rows[0].length, rows: rows.length, colors, cells: [], nextId: 1 }
  for (const line of rows) for (const ch of line) g.cells.push(ch === '.' ? null : { id: g.nextId++, color: Number(ch) })
  return g
}
