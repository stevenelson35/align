// Flashcards (DESIGN.md §5.9): a list kind whose items are cards (title = the front, notes = the back), with each
// person's own results. Importing cards from text or YAML, and the order to study them in. Pure logic, unit-tested.
import type { Task } from '../types'

export interface Card {
  front: string
  back: string
}

export interface CardResult {
  /** Marked "Got it" most recently (vs "Not yet"). */
  known?: boolean
  right?: number
  wrong?: number
  /** The last day studied, YYYY-MM-DD. */
  last?: string
}

export type StudyMode = 'order' | 'shuffle' | 'unknown'
export const STUDY_MODES: { value: StudyMode; label: string }[] = [
  { value: 'order', label: 'In order' },
  { value: 'shuffle', label: 'Shuffled' },
  { value: 'unknown', label: 'Only ones not known yet (shuffled)' },
]

const FRONT_KEYS = ['front', 'q', 'question', 'term', 'word', 'prompt']
const BACK_KEYS = ['back', 'a', 'answer', 'definition', 'meaning', 'response']

function fromObject(o: unknown): Card | null {
  if (!o || typeof o !== 'object') return null
  const rec = Object.fromEntries(Object.entries(o as Record<string, unknown>).map(([k, v]) => [k.toLowerCase(), v]))
  const pick = (keys: string[]) => keys.map((k) => rec[k]).find((v) => v !== undefined && v !== null)
  const front = pick(FRONT_KEYS)
  const back = pick(BACK_KEYS)
  if (front === undefined || back === undefined) {
    // { "Paris": "Capital of France" } style: one key, one value.
    const entries = Object.entries(o as Record<string, unknown>)
    if (entries.length === 1 && typeof entries[0][1] !== 'object') return clean(entries[0][0], String(entries[0][1]))
    return null
  }
  return clean(String(front), String(back))
}

const clean = (front: string, back: string): Card | null => (front.trim() && back.trim() ? { front: front.trim(), back: back.trim() } : null)

/**
 * Cards from plain text, one per line: "front | back", "front<tab>back", or "front :: back"; or pairs of lines
 * "Q: …" then "A: …". Blank lines and lines starting with # are skipped.
 */
export function parseSimpleCards(text: string): Card[] {
  const out: Card[] = []
  let pendingQ: string | null = null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const q = line.match(/^(?:q|question)\s*[:.)]\s*(.+)$/i)
    const a = line.match(/^(?:a|answer)\s*[:.)]\s*(.+)$/i)
    if (q) {
      pendingQ = q[1]
      continue
    }
    if (a && pendingQ !== null) {
      const c = clean(pendingQ, a[1])
      if (c) out.push(c)
      pendingQ = null
      continue
    }
    const parts = line.split(/\s*\|\s*|\t|\s+::\s+/)
    if (parts.length >= 2) {
      const c = clean(parts[0], parts.slice(1).join(' | '))
      if (c) out.push(c)
    }
  }
  return out
}

/** Looks like YAML (a list of mappings, or a "cards:" key)? */
export const looksLikeYaml = (text: string) => /^\s*(-\s+\w+\s*:|cards\s*:|\w+\s*:\s*$)/m.test(text) && !/[|\t]/.test(text.split('\n')[0])

/** Cards from parsed YAML / JSON: a list of { front, back } (or q/a, term/definition…), or { cards: [...] }. */
export function cardsFromData(data: unknown): Card[] {
  const list = Array.isArray(data) ? data : data && typeof data === 'object' && Array.isArray((data as { cards?: unknown }).cards) ? (data as { cards: unknown[] }).cards : null
  if (list) return list.map(fromObject).filter((c): c is Card => !!c)
  // A mapping of front: back pairs.
  if (data && typeof data === 'object') return Object.entries(data as Record<string, unknown>).map(([k, v]) => clean(k, String(v))).filter((c): c is Card => !!c)
  return []
}

/** Any of the formats: YAML (the YAML reader loads only when needed), JSON, or plain lines. */
export async function parseCards(text: string): Promise<Card[]> {
  const t = text.trim()
  if (t.startsWith('[') || t.startsWith('{')) {
    try {
      return cardsFromData(JSON.parse(t))
    } catch {
      // not JSON after all
    }
  }
  if (looksLikeYaml(t)) {
    const { load } = await import('js-yaml')
    try {
      const cards = cardsFromData(load(t))
      if (cards.length) return cards
    } catch {
      // fall back to plain lines
    }
  }
  return parseSimpleCards(t)
}

export const resultFor = (card: Pick<Task, 'results'>, uid: string): CardResult => card.results?.[uid] ?? {}

/** A random order that's the same for the same seed (so a shuffled session doesn't reshuffle as cards update). */
function seeded(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0
    s = Math.imul(s ^ (s >>> 13), 3266489909) >>> 0
    return ((s ^= s >>> 16) >>> 0) / 4294967296
  }
}

/** The cards to study, in study order: as added, shuffled, or only the ones you haven't marked "Got it" (shuffled). */
export function studyOrder<T extends Pick<Task, 'id' | 'results'>>(cards: T[], mode: StudyMode, uid: string, seed: number): T[] {
  const pool = mode === 'unknown' ? cards.filter((c) => !resultFor(c, uid).known) : [...cards]
  if (mode === 'order') return pool
  const rand = seeded(seed)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool
}

/**
 * Multiple choice: the right answer and up to `count - 1` others (different words, from `pool` first, then `extra`),
 * in random order. Fewer than two choices in all means none (a set needs other answers to choose from).
 */
export function choicesFor(answer: string, pool: string[], extra: string[], rand: () => number, count = 4): string[] {
  const key = (s: string) => s.trim().toLowerCase()
  const seen = new Set([key(answer)])
  const others: string[] = []
  const take = (list: string[]) => {
    const mixed = list.map((s) => [rand(), s] as const).sort((a, b) => a[0] - b[0]).map(([, s]) => s)
    for (const s of mixed) {
      if (others.length >= count - 1) return
      if (!s.trim() || seen.has(key(s))) continue
      seen.add(key(s))
      others.push(s.trim())
    }
  }
  take(pool)
  take(extra)
  if (!others.length) return []
  const out = [...others]
  out.splice(Math.floor(rand() * (out.length + 1)), 0, answer.trim())
  return out
}
