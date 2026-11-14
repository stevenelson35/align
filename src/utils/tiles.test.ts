import { describe, expect, it } from 'vitest'
import { addGroup, addTile, closeGroup, closedAt, runsToMore, dayTiles, defaultTiles, groupNames, grouped, known, MORE, placeOf, moveTile, newGroupName, parseTile, removeTile, renameGroup, splitMore, tilesOf } from './tiles'

describe('Today tiles', () => {
  it('starts from the old arrangement: main sections, To Do, Shortcuts as a group, then More…', () => {
    const t = defaultTiles({})
    const { main, more } = splitMore(t)
    expect(main).toEqual(['panel:inbox', 'panel:goals', 'panel:rewards', 'panel:games', 'panel:map', 'panel:contacts', 'panel:photos', 'panel:daily', 'panel:todo'])
    expect(more).toEqual(['panel:gifts', 'panel:lists', 'panel:links', 'panel:projects', 'panel:cards', 'panel:voting', 'panel:invest'])
    const mine = defaultTiles({ todayMore: ['daily', '!voting'], todayItems: ['c1', 'l2'] })
    expect(splitMore(mine).main).toEqual([
      'panel:inbox', 'panel:goals', 'panel:rewards', 'panel:games', 'panel:map', 'panel:contacts', 'panel:gifts', 'panel:lists', 'panel:links',
      'panel:projects', 'panel:cards', 'panel:photos', 'panel:voting', 'panel:todo', 'group:Shortcuts', 'entry:c1', 'entry:l2',
    ])
    expect(splitMore(mine).more).toEqual(['panel:daily', 'panel:invest'])
  })

  it('uses what you saved, with exactly one More… mark and no repeats', () => {
    expect(tilesOf({ today: ['panel:inbox', 'panel:todo', 'entry:a', 'entry:a'], todayItems: ['x'] })).toEqual(['panel:inbox', 'panel:todo', 'entry:a', MORE])
    expect(tilesOf({ today: ['panel:inbox', MORE, 'panel:goals'] })).toEqual(['panel:inbox', MORE, 'panel:goals'])
  })

  it('puts a newly added panel (Inbox) at the top of saved tiles once; taking it off is remembered', () => {
    expect(tilesOf({ today: ['panel:todo', MORE] })).toEqual(['panel:inbox', 'panel:todo', MORE])
    expect(tilesOf({ today: [MORE, 'panel:inbox'] })).toEqual([MORE, 'panel:inbox']) // moved into More…: stays there
    const off = removeTile(tilesOf({ today: ['panel:todo', MORE] }), 'panel:inbox')
    expect(off).toEqual(['panel:todo', MORE, '-panel:inbox'])
    expect(tilesOf({ today: off })).toEqual(off)
    expect(known('-panel:inbox')).toBe(false)
    expect(addTile(off, 'panel:inbox')).toEqual(['panel:todo', 'panel:inbox', MORE])
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
    expect(addTile(t, 'entry:a', 'more')).toEqual(['panel:goals', MORE, 'panel:gifts', 'entry:a'])
    expect(addTile(t, 'panel:gifts')).toBe(t)
    expect(removeTile(t, 'panel:gifts')).toEqual(['panel:goals', MORE])
    expect(removeTile(t, MORE)).toBe(t)
  })

  it('adds above your first group (never into one by accident), or into the group you pick', () => {
    const t = ['panel:goals', 'panel:todo', 'group:Shortcuts', 'entry:c1', 'group:Kids', 'entry:k1', MORE, 'group:Old', 'entry:o1']
    expect(addTile(t, 'list:clothes')).toEqual(['panel:goals', 'panel:todo', 'list:clothes', 'group:Shortcuts', 'entry:c1', 'group:Kids', 'entry:k1', MORE, 'group:Old', 'entry:o1'])
    expect(addTile(t, 'list:x', { group: 'Shortcuts' })).toEqual(['panel:goals', 'panel:todo', 'group:Shortcuts', 'entry:c1', 'list:x', 'group:Kids', 'entry:k1', MORE, 'group:Old', 'entry:o1'])
    expect(addTile(t, 'list:x', { group: 'Kids' }).indexOf('list:x')).toBe(6)
    expect(addTile(t, 'list:x', { group: 'Old' }).at(-1)).toBe('list:x')
    expect(addTile(t, 'list:x', { group: 'Gone' }).indexOf('list:x')).toBe(2)
    expect(placeOf(t, 'entry:k1')).toEqual({ more: false, group: 'Kids' })
    expect(placeOf(t, 'panel:goals')).toEqual({ more: false, group: undefined })
    expect(placeOf(t, 'entry:o1')).toEqual({ more: true, group: 'Old' })
    expect(placeOf(t, 'entry:zz')).toBeNull()
    expect(groupNames(t)).toEqual(['Shortcuts', 'Kids', 'Old'])
    expect(addGroup(t, 'New').slice(t.indexOf(MORE), t.indexOf(MORE) + 2)).toEqual(['group:New', 'end:1']) // empty, above the More… line
    expect(addGroup(t, 'Kids')).toBe(t)
  })

  it('ends a group with an end line, so tiles can sit below a group without being in it', () => {
    const t = ['panel:goals', 'group:Fun', 'panel:daily', 'end:1', 'panel:todo', MORE]
    expect(grouped(splitMore(t).main)).toEqual([{ tiles: ['panel:goals'] }, { name: 'Fun', tiles: ['panel:daily'] }, { tiles: ['panel:todo'] }])
    expect(placeOf(t, 'panel:todo')).toEqual({ more: false, group: undefined })
    expect(addTile(t, 'entry:x', { group: 'Fun' })).toEqual(['panel:goals', 'group:Fun', 'panel:daily', 'entry:x', 'end:1', 'panel:todo', MORE])
    expect(addTile(t, 'entry:x', 'bottom')).toEqual(['panel:goals', 'group:Fun', 'panel:daily', 'end:1', 'panel:todo', 'entry:x', MORE])
    // The main page ending inside a group: 'bottom' closes it first.
    expect(addTile(['group:Fun', 'panel:daily', MORE], 'entry:x', 'bottom')).toEqual(['group:Fun', 'panel:daily', 'end:1', 'entry:x', MORE])
    expect(addGroup(t, 'People')).toEqual(['panel:goals', 'group:Fun', 'panel:daily', 'end:1', 'panel:todo', 'group:People', 'end:2', MORE])
    expect(removeTile(t, 'group:Fun')).toEqual(['panel:goals', 'panel:daily', 'panel:todo', MORE])
    expect(known('end:1')).toBe(true)
    const open = ['group:Shortcuts', 'entry:a', MORE]
    expect(closedAt(open, 0)).toBe(false)
    expect(closeGroup(open, 0)).toEqual(['group:Shortcuts', 'entry:a', 'end:1', MORE])
    expect(closedAt(t, 1)).toBe(true)
    expect(runsToMore(open, 0)).toBe(true)
    expect(runsToMore(['group:A', 'entry:a', 'group:B', MORE], 0)).toBe(false) // B ends A
    expect(runsToMore(t, 1)).toBe(false)
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
