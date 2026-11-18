// Play time for Glider (DESIGN.md §5.16): what learning earns. Pure, unit-tested.

/** The most play time anyone can hold (15 minutes): earn, play, earn again. */
export const MAX_PLAY_SECONDS = 900
/** What learning earns. */
export const EARN = { round: 60, perCard: 5, challenge: 90, element: 10, daily: 15, wordle: 60, puzzle: 30 } as const

/** Daily things that earn play time once a day each: The Daily's items (opening the answer) and Wordle of the day. */
export const DAILY_EARNERS: { id: string; label: string; seconds: number }[] = [
  { id: 'wordle', label: 'Wordle of the day', seconds: EARN.wordle },
  { id: 'lights-out', label: 'Solve Lights Out', seconds: EARN.puzzle },
  { id: 'tower-of-hanoi', label: 'Solve the Tower of Hanoi', seconds: EARN.puzzle },
  { id: 'sliding-tiles', label: 'Solve a Picture Slider', seconds: EARN.puzzle },
  { id: 'word', label: 'Word of the day', seconds: EARN.daily },
  { id: 'quote', label: 'Quote of the day', seconds: EARN.daily },
  { id: 'fact', label: 'Science fact', seconds: EARN.daily },
  { id: 'philosophy', label: 'Mini Philosophy video', seconds: EARN.daily },
  { id: 'think', label: 'Something to think about', seconds: EARN.daily },
  { id: 'riddle', label: 'Riddle', seconds: EARN.daily },
  { id: 'math', label: 'Math puzzle', seconds: EARN.daily },
  { id: 'chess', label: 'Chess puzzle', seconds: EARN.daily },
  { id: 'chessTip', label: 'Chess lesson', seconds: EARN.daily },
  { id: 'poker', label: 'Poker odds', seconds: EARN.daily },
  { id: 'pet', label: 'Pet health tip', seconds: EARN.daily },
  { id: 'petFact', label: 'Dog or cat fact', seconds: EARN.daily },
  { id: 'animal', label: 'Wild animal: what is it?', seconds: EARN.daily },
  { id: 'space', label: 'Space picture', seconds: EARN.daily },
  { id: 'picture', label: 'Picture of the day', seconds: EARN.daily },
]
export const earnsDaily = (id: string) => DAILY_EARNERS.find((d) => d.id === id)?.seconds ?? 0

/** What's already been earned today (the saved list is only for its day). */
export const doneToday = (daily: { day?: string; done?: string[] } | undefined, day: string) => (daily?.day === day ? (daily.done ?? []) : [])
/** A flashcard round must have at least this many answers to count. */
export const MIN_ROUND = 5
/** What a finished flashcard round earns: a Challenge round, or a minute plus 5 s for each card after the first 5. */
export const roundEarns = (answered: number, challenge: boolean) => (answered < MIN_ROUND ? 0 : challenge ? EARN.challenge : EARN.round + EARN.perCard * (answered - MIN_ROUND))

/** "3:05". */
export const playClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
