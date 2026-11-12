import { describe, expect, it } from 'vitest'
import { photoSwipeDirection } from './swipe'

describe('photo swipes', () => {
  it('moves to the next or previous photo for a horizontal swipe', () => {
    expect(photoSwipeDirection(-80, 10)).toBe(1)
    expect(photoSwipeDirection(80, -10)).toBe(-1)
    expect(photoSwipeDirection(-50, 0)).toBe(1)
  })

  it('ignores taps, short drags and vertical scrolling', () => {
    expect(photoSwipeDirection(0, 0)).toBe(0)
    expect(photoSwipeDirection(49, 0)).toBe(0)
    expect(photoSwipeDirection(-100, 100)).toBe(0)
    expect(photoSwipeDirection(60, -120)).toBe(0)
  })
})
