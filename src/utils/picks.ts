// Pick lists (DESIGN.md §5.8): a list of things to choose from (shows, movies, songs…), rated 1–5 by each person,
// and a "Tonight" picker that ranks them for the people who are there. Pure logic, unit-tested.
import { diffDays } from '../engine/dates'
import type { List, Task } from '../types'

export type PickKind = NonNullable<List['pickKind']>

export const PICK_KINDS: { value: PickKind; label: string; did: string; doing: string }[] = [
  { value: 'shows', label: 'Streaming shows', did: 'Watched', doing: 'watch' },
  { value: 'movies', label: 'Streaming movies', did: 'Watched', doing: 'watch' },
  { value: 'theater', label: 'Theater movies', did: 'Seen', doing: 'see' },
  { value: 'music', label: 'Music', did: 'Played', doing: 'play' },
  { value: 'books', label: 'Books', did: 'Read', doing: 'read' },
  { value: 'games', label: 'Games', did: 'Played', doing: 'play' },
  { value: 'other', label: 'Other', did: 'Done', doing: 'pick' },
]
export const pickKind = (k: List['pickKind']) => PICK_KINDS.find((x) => x.value === k) ?? PICK_KINDS.at(-1)!

/** An unrated person counts as "maybe" (3 of 5): unknown, not a no. */
const UNRATED = 3
/** Done this recently: left out of tonight's picks. */
export const REST_DAYS = 30
/** Done within this many days: still ranked, but lower (fading out by then). */
const FADE_DAYS = 180

export interface Ranked {
  item: Task
  /** 0–5: the blend of the group's average and its lowest rating, less a bit if it was done fairly recently. */
  score: number
  /** The ratings of the people watching who have rated it. */
  ratings: { uid: string; stars: number }[]
  /** People watching who haven't rated it. */
  unrated: string[]
  lastDone?: string
  daysSince?: number
}

export const lastDone = (item: Pick<Task, 'watched'>) => item.watched?.slice().sort().at(-1)

export function averageRating(item: Pick<Task, 'ratings'>): number | undefined {
  const v = Object.values(item.ratings ?? {})
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : undefined
}

/**
 * Ranks the items for the people watching. Each item's score blends the group's average with its lowest rating
 * ("least misery": a 5 and a 1 scores below two 4s, so nobody sits through something they hate), treating a missing
 * rating as a maybe. Items done in the last REST_DAYS are left out; ones done within FADE_DAYS lose up to one star,
 * fading back to full by then. Highest score first; ties go to the more recently added.
 */
export function rankPicks(items: Task[], people: string[], today: string): Ranked[] {
  const out: Ranked[] = []
  for (const item of items) {
    const ratings = people.filter((uid) => item.ratings?.[uid] !== undefined).map((uid) => ({ uid, stars: item.ratings![uid] }))
    const unrated = people.filter((uid) => item.ratings?.[uid] === undefined)
    const all = [...ratings.map((r) => r.stars), ...unrated.map(() => UNRATED)]
    if (!all.length) continue
    const mean = all.reduce((a, b) => a + b, 0) / all.length
    const min = Math.min(...all)
    let score = 0.6 * mean + 0.4 * min
    const last = lastDone(item)
    const daysSince = last ? diffDays(last, today) : undefined
    if (daysSince !== undefined && daysSince < REST_DAYS) continue
    if (daysSince !== undefined && daysSince < FADE_DAYS) score -= 1 - (daysSince - REST_DAYS) / (FADE_DAYS - REST_DAYS)
    out.push({ item, score: Math.round(score * 100) / 100, ratings, unrated, lastDone: last, daysSince })
  }
  return out.sort((a, b) => b.score - a.score || (b.item.id > a.item.id ? 1 : -1))
}

/**
 * "Pick for us": one of the top few, chosen at random but weighted toward the higher scores (score² + a little, so
 * a low one can still come up). `random` is injectable for tests.
 */
export function pickOne(ranked: Ranked[], top = 5, random = Math.random): Ranked | undefined {
  const pool = ranked.slice(0, top)
  if (!pool.length) return undefined
  const weights = pool.map((r) => Math.max(0, r.score) ** 2 + 0.25)
  let roll = random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return pool[i]
  }
  return pool.at(-1)
}
