import { describe, expect, it } from 'vitest'
import { parseRoute, routeHash } from '../utils/routes'
import { HELP_TOPICS } from './topics'

describe('help topics', () => {
  it('every topic has a short tip and a body, and a unique id', () => {
    expect(new Set(HELP_TOPICS.map((t) => t.id)).size).toBe(HELP_TOPICS.length)
    for (const t of HELP_TOPICS) {
      expect(t.tip.length).toBeGreaterThan(20)
      expect(t.tip.length).toBeLessThan(260) // a tip stays a sentence or two
      expect(t.body.length).toBeGreaterThan(0)
    }
  })
  it('links to a topic on the Help page', () => {
    expect(parseRoute('#/help/goals')).toEqual({ view: 'help', topic: 'goals' })
    expect(parseRoute('#/help/nope')).toEqual({ view: 'help' })
    expect(routeHash({ view: 'help', topic: 'privacy' })).toBe('#/help/privacy')
  })
})
