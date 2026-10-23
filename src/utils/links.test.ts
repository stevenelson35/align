import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { allCategories, cleanCategory, defaultName, linkTree, safeUrl } from './links'

const l = (title: string, category?: string): Task => ({
  id: title, listId: 'l', visibility: 'family', ownerId: 'o', viewerVisible: false, title, priority: 2, status: 'todo',
  context: 'family', durationDays: 1, dependsOn: [], createdBy: 'o', url: `https://${title}.com`, category,
})

describe('links', () => {
  it('only lets safe addresses be clicked', () => {
    expect(safeUrl('example.com/a b')).toBe('https://example.com/a%20b')
    expect(safeUrl('http://x.org')).toBe('http://x.org/')
    expect(safeUrl('mailto:a@b.com')).toBe('mailto:a@b.com')
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('data:text/html,hi')).toBeNull()
    expect(safeUrl('  ')).toBeNull()
  })
  it('names a link by its host, and tidies categories', () => {
    expect(defaultName('https://www.duke-energy.com/billing')).toBe('duke-energy.com')
    expect(cleanCategory(' Home / Utilities /')).toBe('Home/Utilities')
  })
  it('builds a sorted category tree', () => {
    const tree = linkTree([l('water', 'Home/Utilities'), l('power', 'home/utilities'), l('news'), l('school', 'Alex')])
    expect(tree.links.map((x) => x.title)).toEqual(['news'])
    expect(tree.children.map((c) => c.name)).toEqual(['Alex', 'Home'])
    expect(tree.children[1].children[0]).toMatchObject({ name: 'Utilities', path: 'Home/Utilities' })
    expect(tree.children[1].children[0].links.map((x) => x.title)).toEqual(['power', 'water'])
    expect(allCategories([l('a', 'Home/Utilities'), l('b', 'Alex')])).toEqual(['Alex', 'Home', 'Home/Utilities'])
  })
})
