import { describe, expect, it } from 'vitest'
import { TODAY_SECTIONS } from './today'

describe("Today's panels", () => {
  it('has each panel once, To Do apart (it is a tile of its own)', () => {
    const ids = TODAY_SECTIONS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain('todo')
  })
})
