export const LIGHTS_OUT_SIZE = 5

export function toggleLights(board: boolean[], index: number, size = LIGHTS_OUT_SIZE): boolean[] {
  const next = board.slice()
  const row = Math.floor(index / size)
  const col = index % size
  for (const [r, c] of [[row, col], [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      const cell = r * size + c
      next[cell] = !next[cell]
    }
  }
  return next
}

/** Makes a repeatable, always-solvable board from a seed by starting solved and applying legal moves. */
export function lightsOutScramble(seed: string, size = LIGHTS_OUT_SIZE): number[] {
  let state = 2166136261
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0
  const random = () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822507) + 3266489909) >>> 0
    return state / 0x1_0000_0000
  }
  const moves = size * 3 + Math.floor(random() * size * 2)
  const sequence = Array.from({ length: moves }, () => Math.floor(random() * size * size))
  const board = sequence.reduce((current, move) => toggleLights(current, move, size), Array.from({ length: size * size }, () => false))
  return board.some(Boolean) ? sequence : [...sequence, Math.floor((size * size) / 2)]
}

export function lightsOutBoard(seed: string, size = LIGHTS_OUT_SIZE): boolean[] {
  let board = Array.from({ length: size * size }, () => false)
  for (const move of lightsOutScramble(seed, size)) board = toggleLights(board, move, size)
  return board
}

export const isLightsOutSolved = (board: boolean[]) => board.every((light) => !light)

export function compareLightsOutScores(a: { moves: number; ms: number }, b: { moves: number; ms: number }): number {
  return a.moves - b.moves || a.ms - b.ms
}

export function newLightsOutSeed(): string {
  return crypto.randomUUID()
}
