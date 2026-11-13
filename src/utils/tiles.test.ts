import { describe, expect, it } from 'vitest'
import { addTile, dayTiles, defaultTiles, grouped, known, MORE, moveTile, newGroupName, parseTile, removeTile, renameGroup, splitMore, tilesOf } from './tiles'

describe('Today tiles', () => {
  it('starts from the old arrangement: main sections, To Do, Shortcuts as a group, then More…', () => {
    const t = defaultTiles({})
    const { main, more } = splitMore(t)
    expect(main).toEqual(['panel:goals', 'panel:rewards', 'panel:games', 'panel:map', 'panel:contacts', 'panel:photos', 'panel:daily', 'panel:todo'])
    expect(more).toEqual(['panel:gifts', 'panel:lists', 'panel:links', 'panel:projects', 'panel:cards', 'panel:voting', 'panel:invest'])
    const mine = defaultTiles({ todayMore: ['daily', '!voting'], todayItems: ['c1', 'l2'] })
    expect(splitMore(mine).main).toEqual([
      'panel:goals', 'panel:rewards', 'panel:games', 'panel:map', 'panel:contacts', 'panel:gifts', 'panel:lists', 'panel:links',
      'panel:projects', 'panel:cards', 'panel:photos', 'panel:voting', 'panel:todo', 'group:Shortcuts', 'entry:c1', 'entry:l2',
    ])
    expect(splitMore(mine).more).toEqual(['panel:daily', 'panel:invest'])
  })

  it('uses what you saved, with exactly one More… mark and no repeats', () => {
    expect(tilesOf({ today: ['panel:todo', 'entry:a', 'entry:a'], todayItems: ['x'] })).toEqual(['panel:todo', 'entry:a', MORE])
    expect(tilesOf({ today: [MORE, 'panel:goals'] })).toEqual([MORE, 'panel:goals'])
  })

  it('reads tiles, keeping ids with colons', () => {
    expect(parseTile('person:abc')).toEqual({ kind: 'person', id: 'abc' })
    expect(parseTile('group:Kids: school')).toEqual({ kind: 'group', id: 'Kids: school' })
    expect(parseTile(MORE)).toEqual({ kind: 'more', id: '' })
    expect(known('panel:goals')).toBe(true)
    expect(known('panel:nope')).toBe(false)
    expect(known('widget:x')).toBe(false)
    expect(known('entry:')).toBe(false)
  })

  it('adds to the end of the main page or More…, once', () => {
    const t = ['panel:goals', MORE, 'panel:gifts']
    expect(addTile(t, 'entry:a')).toEqual(['panel:goals', 'entry:a', MORE, 'panel:gifts'])
    expect(addTile(t, 'entry:a', true)).toEqual(['panel:goals', MORE, 'panel:gifts', 'entry:a'])
    expect(addTile(t, 'panel:gifts')).toBe(t)
    expect(removeTile(t, 'panel:gifts')).toEqual(['panel:goals', MORE])
    expect(removeTile(t, MORE)).toBe(t)
  })

  it('moves tiles, across the More… mark too', () => {
    const t = ['a', 'b', MORE, 'c']
    expect(moveTile(t, 0, 1)).toEqual(['b', 'a', MORE, 'c'])
    expect(moveTile(t, 3, 0)).toEqual(['c', 'a', 'b', MORE])
    expect(moveTile(t, 0, 9)).toEqual(['b', MORE, 'c', 'a'])
    expect(moveTile(t, 1, 1)).toBe(t)
  })

  it('names, renames and groups', () => {
    const t = ['panel:goals', 'group:Kids', 'entry:a', 'entry:b', 'group:Links', MORE]
    expect(newGroupName(t)).toBe('Group')
    expect(newGroupName([...t, 'group:Group'])).toBe('Group 2')
    expect(renameGroup(t, 'Kids', '  School   stuff ')).toContain('group:School stuff')
    expect(renameGroup(t, 'Kids', 'Links')).toBe(t)
    expect(renameGroup(t, 'Kids', ' ')).toBe(t)
    expect(grouped(splitMore(t).main)).toEqual([
      { tiles: ['panel:goals'] },
      { name: 'Kids', tiles: ['entry:a', 'entry:b'] },
      { name: 'Links', tiles: [] },
    ])
    expect(grouped(['group:A', 'entry:a'])).toEqual([{ name: 'A', tiles: ['entry:a'] }])
  })

  it('shows only what belongs to a day on other days, in your order', () => {
    expect(dayTiles(['panel:map', 'panel:daily', 'panel:todo', MORE, 'panel:goals'])).toEqual(['panel:daily', 'panel:todo', 'panel:goals', 'panel:photos'])
  })
})
