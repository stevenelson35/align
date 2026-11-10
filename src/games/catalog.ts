export type GameMetric = 'moves' | 'guesses' | 'ms'
export type GameResult = Partial<Record<GameMetric, number>>

export interface GameDefinition {
  id: string
  name: string
  description: string
  scoreOrder: readonly GameMetric[]
}

export const GAMES = [
  {
    id: 'lights-out',
    name: 'Lights Out',
    description: 'Today’s shared 5 × 5 puzzle. Switch off every light; each tap flips that square and its neighbors.',
    scoreOrder: ['moves', 'ms'],
  },
  {
    id: 'tower-of-hanoi',
    name: 'Tower of Hanoi',
    description: 'Move the whole tower to another rod. Move one disk at a time; never place a larger disk on a smaller one.',
    scoreOrder: ['moves', 'ms'],
  },
  {
    id: 'sliding-tiles',
    name: 'Picture Slider',
    description: 'Put the picture back together by sliding tiles into the empty space. Choose a favorite photo and board size.',
    scoreOrder: ['moves', 'ms'],
  },
] as const satisfies readonly GameDefinition[]

export type GameId = (typeof GAMES)[number]['id']
export const DEFAULT_PINNED_GAMES: GameId[] = ['lights-out', 'tower-of-hanoi', 'sliding-tiles']

export const gameById = (id: string) => GAMES.find((game) => game.id === id)

/** Lower metric values win; each game declares which metrics matter and in what order. */
export function compareGameResults(gameId: GameId, a: GameResult, b: GameResult): number {
  const game = gameById(gameId)
  if (!game) throw new Error(`Unknown game: ${gameId}`)
  for (const metric of game.scoreOrder) {
    const difference = (a[metric] ?? Number.POSITIVE_INFINITY) - (b[metric] ?? Number.POSITIVE_INFINITY)
    if (difference) return difference
  }
  return 0
}

export function formatGameResult(gameId: GameId, result: GameResult): string {
  const game = gameById(gameId)
  if (!game) throw new Error(`Unknown game: ${gameId}`)
  return game.scoreOrder
    .filter((metric) => result[metric] !== undefined)
    .map((metric) => metric === 'ms' ? formatTime(result.ms!) : `${result[metric]} ${metric}`)
    .join(' · ')
}

function formatTime(ms: number): string {
  return `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`
}
