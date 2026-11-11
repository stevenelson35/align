export type LetterMark = 'correct' | 'present' | 'absent'

export interface WordleGuess {
  word: string
  marks: LetterMark[]
}

export function decodeWordleProgressRow(row: string | undefined): LetterMark[] {
  return [...(row ?? '')].flatMap((mark) => {
    if (mark === 'C') return ['correct']
    if (mark === 'P') return ['present']
    if (mark === 'A') return ['absent']
    return []
  })
}

export const WORDLE_MAX_GUESSES = 6
export const WORDLE_MIN_LENGTH = 2
export const WORDLE_MAX_LENGTH = 12

export function wordleProgressLabel(progress?: {
  started?: boolean
  rows: readonly string[]
  complete: boolean
  solved: boolean
  status?: 'declined' | 'abandoned'
}): string {
  if (!progress) return 'Invited · 0/6'
  if (progress.status === 'declined') return 'Declined'
  if (progress.status === 'abandoned') return `Gave up · ${progress.rows.length}/6`
  if (progress.complete) return progress.solved ? `Solved · ${progress.rows.length}` : 'Out of guesses'
  return `${progress.started || progress.rows.length ? 'Playing' : 'Ready'} · ${progress.rows.length}/6`
}

export function wordleChallengeFinished(
  players: readonly string[],
  progress: readonly { uid: string; complete: boolean }[],
): boolean {
  return players.length > 0 && players.every((uid) => progress.some((item) => item.uid === uid && item.complete))
}

export function normalizeWord(value: string): string {
  return value.trim().toUpperCase()
}

export function validWord(value: string, length?: number): boolean {
  const word = normalizeWord(value)
  return /^[A-Z]+$/.test(word)
    && word.length >= WORDLE_MIN_LENGTH
    && word.length <= WORDLE_MAX_LENGTH
    && (length === undefined || word.length === length)
}

export function markGuess(answer: string, guess: string): LetterMark[] {
  const target = normalizeWord(answer)
  const attempt = normalizeWord(guess)
  if (!validWord(target) || !validWord(attempt, target.length)) throw new Error('Guess must be a word of the answer length.')

  const marks: LetterMark[] = Array.from({ length: target.length }, () => 'absent')
  const remaining = new Map<string, number>()
  for (let i = 0; i < target.length; i++) {
    if (attempt[i] === target[i]) marks[i] = 'correct'
    else remaining.set(target[i], (remaining.get(target[i]) ?? 0) + 1)
  }
  for (let i = 0; i < attempt.length; i++) {
    if (marks[i] === 'correct') continue
    const count = remaining.get(attempt[i]) ?? 0
    if (count > 0) {
      marks[i] = 'present'
      remaining.set(attempt[i], count - 1)
    }
  }
  return marks
}

export function wordleKeyboardMarks(guesses: WordleGuess[]): Map<string, LetterMark> {
  const marks = new Map<string, LetterMark>()
  const rank = { absent: 0, present: 1, correct: 2 }
  for (const row of guesses) {
    row.word.split('').forEach((letter, index) => {
      const next = row.marks[index]
      const current = marks.get(letter)
      if (next && (current === undefined || rank[next] > rank[current])) marks.set(letter, next)
    })
  }
  return marks
}

export function hardModeError(guesses: WordleGuess[], guess: string): string | null {
  const requiredLetters = new Map<string, number>()
  const fixedLetters = new Map<number, string>()
  const excludedPositions = new Map<number, Set<string>>()

  for (const row of guesses) {
    const rowRequired = new Map<string, number>()
    row.word.split('').forEach((letter, index) => {
      const mark = row.marks[index]
      if (mark === 'correct') {
        fixedLetters.set(index, letter)
        rowRequired.set(letter, (rowRequired.get(letter) ?? 0) + 1)
      } else if (mark === 'present') {
        rowRequired.set(letter, (rowRequired.get(letter) ?? 0) + 1)
        const excluded = excludedPositions.get(index) ?? new Set<string>()
        excluded.add(letter)
        excludedPositions.set(index, excluded)
      }
    })
    for (const [letter, count] of rowRequired) {
      requiredLetters.set(letter, Math.max(requiredLetters.get(letter) ?? 0, count))
    }
  }

  const attempt = normalizeWord(guess)
  for (const [index, letter] of fixedLetters) {
    if (attempt[index] !== letter) return `Keep ${letter} in position ${index + 1}.`
  }
  for (const [index, letters] of excludedPositions) {
    if (letters.has(attempt[index])) return `Move ${attempt[index]} from position ${index + 1}.`
  }
  for (const [letter, count] of requiredLetters) {
    if ([...attempt].filter((candidate) => candidate === letter).length < count) {
      return `Use at least ${count} ${letter}${count === 1 ? '' : 's'} revealed by your earlier guesses.`
    }
  }
  return null
}

export function compareWordleResults(
  a: { guesses: number; ms: number },
  b: { guesses: number; ms: number },
): number {
  return a.guesses - b.guesses || a.ms - b.ms
}
