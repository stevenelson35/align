// Glider (DESIGN.md §5.16): a paper plane in a fixed-size world (400 × 600 units; the screen scales it). Tap to lift;
// it sinks; cloud towers drift in from the right with a gap to fly through. Pure, unit-tested; the screen draws it.

export const W = 400
export const H = 600
export const PLANE_X = 110
export const PLANE_R = 14
const GRAVITY = 1500 // units / s²
const LIFT = -430 // units / s, set on a tap
const SPEED = 150 // units / s, how fast the towers come
const TOWER_W = 70
const GAP = 175
const SPACING = 230 // between towers

export interface Tower {
  x: number
  /** The gap's center. */
  gapY: number
  passed: boolean
}

export interface World {
  y: number
  vy: number
  towers: Tower[]
  score: number
  over: boolean
  /** A seeded random source, so a run can be replayed in tests. */
  seed: number
}

function next(seed: number) {
  const s = (seed * 16807) % 2147483647
  return [s, (s - 1) / 2147483646] as const
}

function tower(x: number, seed: number): [Tower, number] {
  const [s, r] = next(seed)
  return [{ x, gapY: 140 + r * (H - 280), passed: false }, s]
}

export function newWorld(seed = Date.now() % 2147483646 || 1): World {
  let s = seed
  const towers: Tower[] = []
  for (let i = 0; i < 3; i++) {
    const [t, ns] = tower(W + 120 + i * SPACING, s)
    towers.push(t)
    s = ns
  }
  return { y: H / 2, vy: 0, towers, score: 0, over: false, seed: s }
}

export const flap = (w: World): World => (w.over ? w : { ...w, vy: LIFT })

/** Whether the plane touches a tower or leaves the sky. */
export function hits(w: Pick<World, 'y' | 'towers'>): boolean {
  if (w.y - PLANE_R < 0 || w.y + PLANE_R > H) return true
  return w.towers.some((t) => PLANE_X + PLANE_R > t.x && PLANE_X - PLANE_R < t.x + TOWER_W && (w.y - PLANE_R < t.gapY - GAP / 2 || w.y + PLANE_R > t.gapY + GAP / 2))
}

/** Move the world on by `dt` seconds (small steps keep it fair on slow phones). */
export function step(w: World, dt: number): World {
  if (w.over) return w
  let cur = w
  for (let left = Math.min(dt, 0.1); left > 0; left -= 1 / 120) {
    const d = Math.min(left, 1 / 120)
    let { y, vy, score, seed } = cur
    vy += GRAVITY * d
    y += vy * d
    let towers = cur.towers.map((t) => ({ ...t, x: t.x - SPEED * d }))
    for (const t of towers)
      if (!t.passed && t.x + TOWER_W < PLANE_X - PLANE_R) {
        t.passed = true
        score++
      }
    if (towers[0].x + TOWER_W < 0) {
      const [t, s] = tower(towers[towers.length - 1].x + SPACING, seed)
      towers = [...towers.slice(1), t]
      seed = s
    }
    cur = { y, vy, towers, score, seed, over: false }
    if (hits(cur)) return { ...cur, over: true }
  }
  return cur
}

export const TOWER = { width: TOWER_W, gap: GAP }
