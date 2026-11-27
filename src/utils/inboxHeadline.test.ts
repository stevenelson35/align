import { describe, expect, it } from 'vitest'
import { actionLabel, headline } from './inboxHeadline'

describe('an Inbox message in one line', () => {
  it('reads game messages as what the sender did', () => {
    const result = { kind: 'result', title: 'completed today’s Wordle (Fri, Nov 20): 3/6 in 2:03', link: '#/games/play/wordle/2026-11-20' }
    expect(headline('Ann', result)).toBe('Ann completed today’s Wordle (Fri, Nov 20): 3/6 in 2:03')
    expect(actionLabel(result)).toBe('Play it too')
    expect(actionLabel({ ...result, link: '#/games/play/wordle/2026-11-20/results' })).toBe('See results')
    const race = { kind: 'game', title: 'invited you to a real-time Wordle race', link: '#/games/abc' }
    expect(headline('Ann', race)).toBe('Ann invited you to a real-time Wordle race')
    expect(actionLabel(race)).toBe('Play')
  })
  it('keeps older messages clear', () => {
    expect(headline('Ann', { kind: 'game', title: 'Wordle 3/6 in 2:03 · 2026-11-20', link: '#/games/play/wordle' })).toBe('Ann shared a result: Wordle 3/6 in 2:03 · 2026-11-20')
    expect(actionLabel({ kind: 'game', title: 'Wordle 3/6', link: '#/games/play/wordle' })).toBe('Play it too')
    expect(headline('Ann', { kind: 'game', title: 'Lights Out', link: '#/games/x' })).toBe('Ann invited you: Lights Out')
    expect(headline('Ann', { kind: 'entry', title: 'Buy milk', link: '#/task/1' })).toBe('Ann: Buy milk')
    expect(actionLabel({ kind: 'note', title: 'Hi', link: '#/' })).toBe('Open')
    expect(headline('Ann', { kind: 'challenge', title: 'reached 50% in The Road to 40', link: '#/challenges' })).toBe('Ann reached 50% in The Road to 40')
  })
})
