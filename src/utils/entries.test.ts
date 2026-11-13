import { describe, expect, it } from 'vitest'
import { defaultSize, sizeKey } from './entries'

describe('entry rows', () => {
  it('start each list kind at a sensible size', () => {
    expect(defaultSize('notes')).toBe('detail')
    expect(defaultSize('checklist')).toBe('simple')
    expect(defaultSize('cards')).toBe('simple')
    expect(['list', 'project', 'links', 'picks', 'contacts', 'gifts'].map((k) => defaultSize(k as never))).toEqual(Array(6).fill('medium'))
    expect(sizeKey('abc')).toBe('align-entry-size:abc')
  })
})
