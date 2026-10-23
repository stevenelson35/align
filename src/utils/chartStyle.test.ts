import { describe, expect, it } from 'vitest'
import { datatypeBars, datatypeLine, datatypePie, to100 } from './chartStyle'

describe('Datatype chart text', () => {
  it('scales values to 0–100 and keeps the latest 20', () => {
    expect(to100([195, 197.5, 200])).toEqual([0, 50, 100])
    expect(to100(Array.from({ length: 25 }, (_, i) => i)).length).toBe(20)
  })
  it('writes sparklines, bars and pies', () => {
    expect(datatypeLine([200, 198, 196], 194, 200)).toBe('{l:100,67,33}')
    expect(datatypeBars([2, 8, 4], 8)).toBe('{b:25,100,50}')
    expect(datatypePie(350 / 3000)).toBe('{p:12}')
  })
})
