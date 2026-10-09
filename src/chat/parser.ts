// Rule-based chat command parser (DESIGN.md §9). Turns text into a Command; resolving names happens in execute.ts.
import * as chrono from 'chrono-node'
import { toDay } from '../engine/dates'
import type { Context, Priority } from '../types'

export type Command =
  | { type: 'help' }
  | {
      type: 'add'
      title: string
      startDate?: string
      targetDate?: string
      listName?: string
      /** The title to use if listName doesn't match a list ("take dog to vet"). */
      titleWithoutList?: string
      context?: Context
      forNames?: string[]
      /** The "for ..." text as typed: put back in the title if none of forNames is a person or pet ("plan for door repair"). */
      forText?: string
      priority?: Priority
    }
  | { type: 'done'; task: string }
  | { type: 'move'; task: string; date: string }
  | { type: 'meet'; task: string; date: string }
  | { type: 'recalculate'; list: string }
  | { type: 'show'; what: 'today' | 'work' }
  | { type: 'showBoard'; board: string }
  | { type: 'showNamed'; name: string }
  | { type: 'vote'; tokens: number; item: string; board?: string }
  | { type: 'error'; message: string }

export function parseDay(text: string, ref = new Date()): string | undefined {
  const date = chrono.parseDate(text, ref, { forwardDate: true })
  return date ? toDay(date) : undefined
}

const PRIORITIES: Record<string, Priority> = { high: 1, '1': 1, medium: 2, normal: 2, '2': 2, low: 3, '3': 3 }

function stripSuffix(name: string) {
  return name.replace(/\s+(project|list|board)$/i, '').trim()
}

function splitNames(text: string) {
  return text
    .split(/\s*(?:,|\band\b|&)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseAdd(rest: string, ref: Date): Command {
  // Clauses start at a keyword: on <date>, by <date>, to <list>, for <work|family|names>, priority <level>.
  const parts = rest.split(/\s+(on|by|to|for|priority)\s+/i)
  const title = parts[0].trim()
  if (!title) return { type: 'error', message: 'What should the task be called? Try "add task water plants".' }
  const cmd: Extract<Command, { type: 'add' }> = { type: 'add', title }
  for (let i = 1; i < parts.length; i += 2) {
    const kw = parts[i].toLowerCase()
    const value = (parts[i + 1] ?? '').trim()
    if (kw === 'on' || kw === 'by') {
      const day = parseDay(value, ref)
      if (!day) return { type: 'error', message: `I couldn't read the date "${value}".` }
      if (kw === 'on') cmd.startDate = day
      else cmd.targetDate = day
    } else if (kw === 'to') {
      cmd.listName = stripSuffix(value)
      cmd.titleWithoutList = `${title} to ${value}`
    } else if (kw === 'for') {
      const v = value.toLowerCase()
      if (v === 'work' || v === 'family') cmd.context = v
      else {
        cmd.forNames = splitNames(value)
        cmd.forText = value
      }
    } else if (kw === 'priority') {
      const p = PRIORITIES[value.toLowerCase()]
      if (!p) return { type: 'error', message: `Priority should be high, medium or low, not "${value}".` }
      cmd.priority = p
    }
  }
  // A trailing date without "on" ("water plants tomorrow") is the start date.
  if (!cmd.startDate && !cmd.targetDate) {
    const found = chrono.parse(rest, ref, { forwardDate: true }).at(-1)
    if (found && found.index > 0 && found.index + found.text.length === rest.length) {
      const strip = (s?: string) => (s?.endsWith(found.text) ? s.slice(0, -found.text.length).trim() || undefined : s)
      cmd.startDate = toDay(found.start.date())
      cmd.title = strip(cmd.title) ?? cmd.title
      cmd.listName = strip(cmd.listName)
      cmd.titleWithoutList = strip(cmd.titleWithoutList)
      if (!cmd.listName) delete cmd.titleWithoutList
      // "flea meds for Dog tomorrow": the date isn't part of the last name.
      cmd.forText = strip(cmd.forText)
      if (cmd.forNames) {
        const last = strip(cmd.forNames.at(-1))
        cmd.forNames = last ? [...cmd.forNames.slice(0, -1), last] : cmd.forNames.slice(0, -1)
        if (!cmd.forNames.length) delete cmd.forNames
      }
      if (!cmd.forNames) delete cmd.forText
    }
  }
  return cmd
}

export function parse(input: string, ref = new Date()): Command {
  const text = input.trim().replace(/[.!?]+$/, '')
  let m: RegExpMatchArray | null

  if (/^(help|\?|commands)$/i.test(text)) return { type: 'help' }

  if ((m = text.match(/^(?:add|new|create)(?:\s+(?:a\s+)?task)?\s+(.+)$/i))) return parseAdd(m[1], ref)

  if ((m = text.match(/^(?:done|complete|finish|finished|mark)\s+(.+?)(?:\s+(?:as\s+)?(?:done|complete))?$/i)))
    return { type: 'done', task: m[1] }

  if ((m = text.match(/^(?:move|reschedule)\s+(.+)\s+to\s+(.+)$/i))) {
    const date = parseDay(m[2], ref)
    return date ? { type: 'move', task: m[1], date } : { type: 'error', message: `I couldn't read the date "${m[2]}".` }
  }

  if (
    (m = text.match(
      /^(?:shift\s+(?:the\s+)?(?:dependencies|deps|prerequisites)\s+so\s+(?:that\s+)?|meet\s+|make\s+)(.+?)\s+(?:is\s+|are\s+)?(?:done\s+|finished\s+|complete\s+)?by\s+(.+)$/i,
    ))
  ) {
    const date = parseDay(m[2], ref)
    return date ? { type: 'meet', task: m[1], date } : { type: 'error', message: `I couldn't read the date "${m[2]}".` }
  }

  if ((m = text.match(/^recalc(?:ulate)?\s+(.+)$/i))) return { type: 'recalculate', list: stripSuffix(m[1]) }

  if ((m = text.match(/^show\s+(?:me\s+)?(.+)$/i))) {
    const what = m[1].toLowerCase()
    if (what === 'today') return { type: 'show', what: 'today' }
    if (what === 'work') return { type: 'show', what: 'work' }
    const board = m[1].match(/^board\s+(.+)$/i)
    if (board) return { type: 'showBoard', board: board[1] }
    return { type: 'showNamed', name: stripSuffix(m[1]) }
  }

  if ((m = text.match(/^vote\s+(\d+)\s+(?:tokens?\s+)?(?:on|for)\s+(.+)$/i))) {
    const tokens = Number(m[1])
    const at = m[2].toLowerCase().lastIndexOf(' in ')
    return at < 0
      ? { type: 'vote', tokens, item: m[2].trim() }
      : { type: 'vote', tokens, item: m[2].slice(0, at).trim(), board: stripSuffix(m[2].slice(at + 4)) }
  }

  return { type: 'error', message: `I didn't understand "${input.trim()}". Type "help" to see what I can do.` }
}

export const HELP_TEXT = [
  'add task fertilize lawn on Oct 5 to Lawn project for work priority high',
  'done fertilize lawn',
  'move fertilize lawn to Oct 8',
  'shift dependencies so apply fertilizer is done by Oct 10',
  'recalculate lawn',
  'show today · show work · show board weekend activities · show lawn',
  'vote 3 on tacos in restaurants',
]
