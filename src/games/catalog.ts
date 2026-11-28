export type GameMetric = 'hints' | 'moves' | 'guesses' | 'ms'
export type GameResult = Partial<Record<GameMetric, number>> & { hardMode?: boolean }

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
    scoreOrder: ['hints', 'moves', 'ms'],
  },
  {
    id: 'tower-of-hanoi',
    name: 'Tower of Hanoi',
    description: 'Choose 3–6 disks and move the whole tower to another rod. Move one disk at a time; never place a larger disk on a smaller one.',
    scoreOrder: ['moves', 'ms'],
  },
  {
    id: 'sliding-tiles',
    name: 'Picture Slider',
    description: 'Put the picture back together by sliding tiles into the empty space. Choose a favorite photo and board size.',
    scoreOrder: ['moves', 'ms'],
  },
  {
    id: 'wordle',
    name: 'Wordle',
    description: 'Guess the shared daily word, choose a word to challenge family, or start a live random-word race.',
    scoreOrder: ['guesses', 'ms'],
  },
  {
    id: 'trail',
    name: 'Trail',
    description: 'Today’s path puzzle: one line from 1 through every number in order that fills every square.',
    scoreOrder: ['hints', 'ms'],
  },
  {
    id: 'balance',
    name: 'Balance',
    description: 'Today’s two-color puzzle: three of each in every row and column, never three side by side, = and × between squares.',
    scoreOrder: ['hints', 'ms'],
  },
  {
    id: 'stars',
    name: 'Star Fields',
    description: 'Today’s star puzzle: one star in every row, column and colored area, and no two stars touching.',
    scoreOrder: ['hints', 'ms'],
  },
  {
    id: 'blocks',
    name: 'Blocks',
    description: 'Today’s rectangle puzzle: cut the grid into rectangles, each holding one number that says its size.',
    scoreOrder: ['hints', 'ms'],
  },
  {
    id: 'combine',
    name: 'Sum Up',
    description: 'Today’s number puzzle: swipe equal neighbors together into their sum until one square is left. 3 × 3, or bigger for a challenge.',
    scoreOrder: ['hints', 'ms'],
  },
  {
    id: 'glider',
    name: 'Glider',
    description: 'Tap to keep the paper plane up between the cloud towers. Played with time you earn from flashcards and the periodic table.',
    scoreOrder: [],
  },
] as const satisfies readonly GameDefinition[]

export type GameId = (typeof GAMES)[number]['id']
export const DEFAULT_PINNED_GAMES: GameId[] = ['lights-out', 'tower-of-hanoi', 'sliding-tiles', 'wordle', 'glider']

export const gameById = (id: string) => GAMES.find((game) => game.id === id)

/** Lower metric values win; each game declares which metrics matter and in what order. */
export function compareGameResults(gameId: GameId, a: GameResult, b: GameResult): number {
  const game = gameById(gameId)
  if (!game) throw new Error(`Unknown game: ${gameId}`)
  for (const metric of game.scoreOrder) {
    // No hints recorded = none taken.
    const missing = metric === 'hints' ? 0 : Number.POSITIVE_INFINITY
    const difference = (a[metric] ?? missing) - (b[metric] ?? missing)
    if (difference) return difference
  }
  return 0
}

export function formatGameResult(gameId: GameId, result: GameResult): string {
  const game = gameById(gameId)
  if (!game) throw new Error(`Unknown game: ${gameId}`)
  return game.scoreOrder
    .filter((metric) => result[metric] !== undefined && !(metric === 'hints' && !result.hints))
    .map((metric) => (metric === 'ms' ? formatTime(result.ms!) : metric === 'hints' ? `${result.hints} hint${result.hints === 1 ? '' : 's'}` : `${result[metric]} ${metric}`))
    .sort((a, b) => Number(a.includes('hint')) - Number(b.includes('hint')))
    .join(' · ')
}

function formatTime(ms: number): string {
  return `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`
}

/** The daily games, in the order "Play today's daily games" goes through them (each has a new puzzle every day). */
export const DAILY_GAMES: GameId[] = ['wordle', 'trail', 'balance', 'stars', 'blocks', 'combine', 'lights-out']
export const isDailyGame = (id: string) => (DAILY_GAMES as string[]).includes(id)

/** The first daily game not finished today (or the first, when all are). */
export const nextDaily = (done: Set<string>): GameId => DAILY_GAMES.find((g) => !done.has(g)) ?? DAILY_GAMES[0]

/** The daily game after this one (round the set). */
export const dailyAfter = (id: GameId): GameId => DAILY_GAMES[(DAILY_GAMES.indexOf(id) + 1) % DAILY_GAMES.length]
