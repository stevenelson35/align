import { describe, expect, it } from 'vitest'
import { TODAY_SECTIONS } from './today'
import { addGroup, addSubgroup, addTile, allInFolder, folderTree, moveToFolder, closeGroup, closedAt, runsToMore, tilesInGroup, dayTiles, defaultTiles, groupNames, grouped, known, MORE, placeOf, moveTile, newGroupName, parseTile, removeTile, renameGroup, splitMore, tilesOf } from './tiles'

describe('Today tiles', () => {
  it('starts someone new with the family layout: On this day, Inbox, Goals, Fun, People, Gifts, To Do, the rest in More…', () => {
    const t = defaultTiles()
    expect(splitMore(t).main).toEqual(['panel:weather', 'panel:photos', 'panel:inbox', 'panel:goals', 'group:Fun', 'panel:daily', 'panel:games', 'game:wordle', 'panel:rewards', 'panel:cards', 'panel:elements', 'game:glider', 'group:People', 'panel:map', 'panel:contacts', 'end:1', 'panel:gifts', 'panel:todo'])
    expect(splitMore(t).more).toEqual(['panel:lists', 'panel:links', 'panel:projects', 'panel:voting', 'panel:invest'])
    // Every panel is somewhere, once (a new panel added to TODAY_SECTIONS lands in More… by itself).
    expect(TODAY_SECTIONS.every((s) => t.filter((x) => x === `panel:${s.id}`).length === 1)).toBe(true)
    expect(tilesOf({})).toEqual(t)
  })

  it('uses what you saved, with exactly one More… mark and no repeats', () => {
    expect(tilesOf({ today: ['panel:weather', 'panel:inbox', 'panel:todo', 'entry:a', 'entry:a'] })).toEqual(['panel:weather', 'panel:inbox', 'panel:todo', 'entry:a', MORE])
    expect(tilesOf({ today: ['panel:weather', 'panel:inbox', MORE, 'panel:goals'] })).toEqual(['panel:weather', 'panel:inbox', MORE, 'panel:goals'])
  })

  it('puts a newly added panel (Inbox) at the top of saved tiles once; taking it off is remembered', () => {
    expect(tilesOf({ today: ['panel:todo', MORE] })).toEqual(['panel:weather', 'panel:inbox', 'panel:todo', MORE])
    expect(tilesOf({ today: [MORE, 'panel:inbox', 'panel:weather'] })).toEqual([MORE, 'panel:inbox', 'panel:weather']) // moved into More…: stays there
    const off = removeTile(tilesOf({ today: ['panel:weather', 'panel:todo', MORE] }), 'panel:inbox')
    expect(off).toEqual(['panel:weather', 'panel:todo', MORE, '-panel:inbox'])
    expect(tilesOf({ today: off })).toEqual(off)
    expect(known('-panel:inbox')).toBe(false)
    expect(addTile(off, 'panel:inbox')).toEqual(['panel:weather', 'panel:todo', 'panel:inbox', MORE])
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
    expect(tilesInGroup(t, 'Fun')).toEqual(['panel:daily'])
    expect(tilesInGroup(['group:A', 'entry:a', 'entry:b', 'group:B', 'entry:c', MORE, 'x'], 'B')).toEqual(['entry:c'])
    expect(tilesInGroup(t, 'Nope')).toEqual([])
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

  it('nests folders by name ("Info/People" is in Info), each holding its tiles, then its folders', () => {
    const t = ['panel:inbox', 'group:Info', 'panel:links', 'group:Info/People', 'panel:map', 'end:1', 'group:Fun', 'panel:games', 'end:2', 'panel:todo', MORE, 'panel:invest']
    const tree = folderTree(splitMore(t).main)
    expect(tree.map((n) => (n.kind === 'tiles' ? n.tiles.join(',') : n.folder.label))).toEqual(['panel:inbox', 'Info', 'Fun', 'panel:todo'])
    const info = tree[1].kind === 'folder' ? tree[1].folder : null
    expect(info?.tiles).toEqual(['panel:links'])
    expect(info?.children.map((c) => [c.label, c.tiles])).toEqual([['People', ['panel:map']]])
    expect(allInFolder(info!)).toEqual(['panel:links', 'panel:map'])
    // A folder whose parent is gone shows on its own, with its whole name.
    expect(folderTree(['group:Gone/Kids', 'panel:map']).map((n) => (n.kind === 'folder' ? n.folder.label : ''))).toEqual(['Gone › Kids'])
  })

  it('adds a folder inside another, moves tiles into and out of folders, and renames or removes them with their folders', () => {
    const t = ['group:Info', 'panel:links', 'end:1', 'panel:todo', MORE]
    const sub = addSubgroup(t, 'Info', 'Peo/ple')
    expect(sub).toEqual(['group:Info', 'panel:links', 'group:Info/Peo-ple', 'end:1', 'panel:todo', MORE])
    expect(addSubgroup(sub, 'Info', 'Peo/ple')).toBe(sub)
    const moved = moveToFolder(sub, 'panel:todo', 'Info/Peo-ple')
    expect(moved).toEqual(['group:Info', 'panel:links', 'group:Info/Peo-ple', 'panel:todo', 'end:1', MORE])
    expect(placeOf(moved, 'panel:todo')?.group).toBe('Info/Peo-ple')
    expect(placeOf(moveToFolder(moved, 'panel:todo', null), 'panel:todo')).toEqual({ more: false, group: undefined })
    expect(placeOf(moveToFolder(moved, 'panel:todo', 'more'), 'panel:todo')?.more).toBe(true)
    const renamed = renameGroup(moved, 'Info', 'Reference')
    expect(renamed.filter((x) => x.startsWith('group:'))).toEqual(['group:Reference', 'group:Reference/Peo-ple'])
    expect(renameGroup(moved, 'Info/Peo-ple', 'Folks').filter((x) => x.startsWith('group:'))).toEqual(['group:Info', 'group:Info/Folks'])
    expect(removeTile(moved, 'group:Info').filter((x) => x.startsWith('group:'))).toEqual(['group:Peo-ple'])
  })
})
