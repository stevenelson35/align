import { describe, expect, it } from 'vitest'
import { tokenBalance, weeksElapsed } from './tokens'

describe('weeksElapsed', () => {
  const start = new Date('2026-09-21T00:00:00Z')

  it('grants the first week immediately and one more every 7 days', () => {
    expect(weeksElapsed(start, new Date('2026-09-21T00:00:00Z'))).toBe(1)
    expect(weeksElapsed(start, new Date('2026-09-27T23:00:00Z'))).toBe(1)
    expect(weeksElapsed(start, new Date('2026-09-28T00:00:00Z'))).toBe(2)
  })

  it('grants nothing before the start date', () => {
    expect(weeksElapsed(start, new Date('2026-09-01T00:00:00Z'))).toBe(0)
  })
})

describe('tokenBalance', () => {
  it('rolls over unused tokens, spends chosen and returns archived', () => {
    const votes = [
      { tokens: 3, itemStatus: 'open' as const },
      { tokens: 4, itemStatus: 'chosen' as const },
      { tokens: 5, itemStatus: 'archived' as const },
      { tokens: 2, itemStatus: undefined },
    ]
    expect(tokenBalance(10, 3, votes)).toBe(23)
  })
})
