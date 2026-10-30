// Goal celebrations: anything can start one; Celebrations (mounted once in the shell) draws it.

/** What finished: `done` of `total` today, near a point on screen (the goal you just ticked), in your color. */
export interface Celebration {
  done: number
  total: number
  x?: number
  y?: number
  color?: string
  /** A quick sparkle (a flashcard you got), bigger for a longer run of right answers; no banner. */
  small?: { run: number }
  /** The banner's words for a finished one, instead of "All N done today". */
  message?: string
  /** Sparkles only, no banner (something else is saying it). */
  quiet?: boolean
}

export const CELEBRATE_EVENT = 'align-celebrate'

export const celebrate = (c: Celebration) => window.dispatchEvent(new CustomEvent<Celebration>(CELEBRATE_EVENT, { detail: c }))
