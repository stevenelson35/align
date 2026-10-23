// The Daily's math puzzle: made up fresh from the day and a grade (1–8), so there's a new one every day without a
// list to run out. The same day and grade give the same puzzle for everyone.

export interface MathPuzzle {
  question: string
  answer: string
}

/** A little seeded random-number generator: the same seed gives the same numbers. */
function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0
    s = Math.imul(s ^ (s >>> 13), 3266489909) >>> 0
    return ((s ^= s >>> 16) >>> 0) / 4294967296
  }
}

function seedOf(day: string, grade: number): number {
  let h = 2166136261
  for (const c of `${day}:${grade}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

const NAMES = ['Sam', 'Alex', 'Maya', 'Leo', 'Ava', 'Noah', 'Zoe', 'Eli']
const THINGS = ['apples', 'stickers', 'marbles', 'cookies', 'shells', 'pencils', 'cards', 'stamps']

export function mathPuzzle(day: string, grade: number): MathPuzzle {
  const r = rng(seedOf(day, grade))
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const name = pick(NAMES)
  const thing = pick(THINGS)
  const kind = int(0, 2)
  switch (Math.max(1, Math.min(8, Math.round(grade)))) {
    case 1: {
      const a = int(2, 9)
      const b = int(1, 9)
      return kind === 0
        ? { question: `${name} has ${a} ${thing} and gets ${b} more. How many now?`, answer: `${a + b}` }
        : { question: `${a + b} − ${b} = ?`, answer: `${a}` }
    }
    case 2: {
      const a = int(12, 60)
      const b = int(5, 39)
      return kind === 0
        ? { question: `${a} + ${b} = ?`, answer: `${a + b}` }
        : { question: `${name} had ${a + b} ${thing} and gave away ${b}. How many are left?`, answer: `${a}` }
    }
    case 3: {
      const a = int(2, 10)
      const b = int(2, 10)
      return kind === 0
        ? { question: `${a} × ${b} = ?`, answer: `${a * b}` }
        : { question: `${a} bags each hold ${b} ${thing}. How many ${thing} in all?`, answer: `${a * b}` }
    }
    case 4: {
      const b = int(3, 12)
      const q = int(4, 15)
      const rem = kind === 2 ? int(1, b - 1) : 0
      return kind === 2
        ? { question: `${q * b + rem} ${thing} shared equally by ${b} friends. How many each, and how many left over?`, answer: `${q} each, ${rem} left over` }
        : { question: `${q * b} ÷ ${b} = ?`, answer: `${q}` }
    }
    case 5: {
      const d = pick([4, 5, 6, 8, 10])
      const n1 = int(1, d - 1)
      const n2 = int(1, d - n1)
      if (kind === 0) return { question: `${n1}/${d} + ${n2}/${d} = ?`, answer: simplify(n1 + n2, d) }
      const a = int(11, 99) / 10
      const b = int(11, 99) / 10
      return { question: `${a.toFixed(1)} + ${b.toFixed(1)} = ?`, answer: (a + b).toFixed(1) }
    }
    case 6: {
      const pct = pick([10, 20, 25, 50, 75])
      const whole = pick([20, 40, 60, 80, 120, 200])
      if (kind === 0) return { question: `What is ${pct}% of ${whole}?`, answer: `${(pct * whole) / 100}` }
      const a = int(2, 5)
      const b = int(2, 5)
      const k = int(2, 6)
      return { question: `The ratio of red to blue marbles is ${a}:${b}. With ${a * k} red marbles, how many blue?`, answer: `${b * k}` }
    }
    case 7: {
      const x = int(-9, 9) || 4
      const a = int(2, 6)
      const b = int(-12, 12)
      if (kind === 0) return { question: `Solve: ${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${a * x + b}`, answer: `x = ${x}` }
      const m = int(-12, -2)
      const n = int(3, 15)
      const k = int(-6, -1)
      return { question: `${m} + ${n} − (${k}) = ?`, answer: `${m + n - k}` }
    }
    default: {
      const m = int(2, 6)
      const b = int(-5, 9)
      const x = int(1, 6)
      if (kind === 0) return { question: `On the line y = ${m}x ${b < 0 ? '−' : '+'} ${Math.abs(b)}, what is y when x = ${x}?`, answer: `y = ${m * x + b}` }
      const base = int(2, 5)
      const e = int(2, 4)
      return { question: `${base}^${e} = ?  (${base} to the power of ${e})`, answer: `${base ** e}` }
    }
  }
}

function simplify(n: number, d: number): string {
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a)
  const k = g(n, d)
  const nn = n / k
  const dd = d / k
  return dd === 1 ? `${nn}` : `${nn}/${dd}`
}
