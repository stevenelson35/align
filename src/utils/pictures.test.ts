import { describe, expect, it } from 'vitest'
import { cropRect, fitWithin, isStoredImage, storedImageId, storedImageRef } from './pictures'

describe('pictures', () => {
  it('crops the largest rectangle of a shape, zoomed and moved but never past the edges', () => {
    expect(cropRect(4000, 3000, null, 1, 0, 0)).toEqual({ x: 0, y: 0, w: 4000, h: 3000 })
    expect(cropRect(4000, 3000, 1, 1, 0, 0)).toEqual({ x: 500, y: 0, w: 3000, h: 3000 })
    expect(cropRect(4000, 3000, 1, 2, 0, 0)).toEqual({ x: 1250, y: 750, w: 1500, h: 1500 })
    expect(cropRect(4000, 3000, 1, 1, 9999, -9999)).toEqual({ x: 1000, y: 0, w: 3000, h: 3000 })
    expect(cropRect(3000, 4000, 16 / 9, 1, 0, 0).w).toBe(3000)
  })
  it('shrinks to fit the longest side', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ w: 1600, h: 1200 })
    expect(fitWithin(800, 600, 1600)).toEqual({ w: 800, h: 600 })
  })
  it('marks stored pictures in an entry’s images list', () => {
    expect(storedImageRef('abc')).toBe('align-image:abc')
    expect(isStoredImage('align-image:abc')).toBe(true)
    expect(isStoredImage('https://example.com/a.jpg')).toBe(false)
    expect(storedImageId('align-image:abc')).toBe('abc')
  })
})
