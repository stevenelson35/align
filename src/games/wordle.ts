export type LetterMark = 'correct' | 'present' | 'absent'

export interface WordleGuess {
  word: string
  marks: LetterMark[]
}

export const WORDLE_MAX_GUESSES = 6
export const WORDLE_MIN_LENGTH = 2
export const WORDLE_MAX_LENGTH = 12

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

export function compareWordleResults(
  a: { guesses: number; ms: number },
  b: { guesses: number; ms: number },
): number {
  return a.guesses - b.guesses || a.ms - b.ms
}
