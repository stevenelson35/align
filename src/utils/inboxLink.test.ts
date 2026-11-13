import { describe, expect, it } from 'vitest'
import { inboxLink } from './inboxLink'

describe('Inbox links', () => {
  const origin = 'https://align.example.com/'
  it('keeps Align addresses as #/… so they open in the app', () => {
    expect(inboxLink('https://align.example.com/#/task/t1', origin)).toBe('#/task/t1')
    expect(inboxLink('#/board/b1', origin)).toBe('#/board/b1')
  })
  it('leaves other sites as they are, and caps the length', () => {
    expect(inboxLink('https://blog.example.com/post', origin)).toBe('https://blog.example.com/post')
    expect(inboxLink(`https://x.example.com/${'a'.repeat(600)}`, origin)).toHaveLength(500)
  })
})
