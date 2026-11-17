// Play time for Glider (DESIGN.md §5.16): what learning earns. Pure, unit-tested.

/** The most play time anyone can hold (15 minutes): earn, play, earn again. */
export const MAX_PLAY_SECONDS = 900
/** What learning earns. */
export const EARN = { round: 60, perCard: 5, challenge: 90, element: 10 } as const
/** A flashcard round must have at least this many answers to count. */
export const MIN_ROUND = 5
/** What a finished flashcard round earns: a Challenge round, or a minute plus 5 s for each card after the first 5. */
export const roundEarns = (answered: number, challenge: boolean) => (answered < MIN_ROUND ? 0 : challenge ? EARN.challenge : EARN.round + EARN.perCard * (answered - MIN_ROUND))

/** "3:05". */
export const playClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
