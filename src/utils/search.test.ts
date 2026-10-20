import { describe, expect, it } from 'vitest'
import type { List, Task } from '../types'
import { searchAll } from './search'

const t = (id: string, title: string, over: Partial<Task> = {}): Task => ({
  id, listId: 'l1', visibility: 'family', ownerId: 'o', viewerVisible: false, title, priority: 2, status: 'todo',
  context: 'family', durationDays: 1, dependsOn: [], createdBy: 'o', ...over,
})
const lists = [{ id: 'l1', name: 'Laundry Room Door', kind: 'project', visibility: 'family', ownerId: 'o', viewerVisible: false, defaultContext: 'family' }] as List[]

describe('searchAll', () => {
  it('finds lists, tasks and items by every word, title matches and open tasks first', () => {
    const tasks = [t('a', 'Paint door', { status: 'done' }), t('b', 'Buy paint'), t('c', 'Sand', { notes: 'before you paint' })]
    const items = [t('d', 'Wi-Fi', { notes: 'password: paint123' })]
    expect(searchAll('paint', tasks, items, lists).map((r) => (r.kind === 'list' ? r.list.id : r.task.id))).toEqual(['b', 'c', 'd', 'a'])
    expect(searchAll('laundry door', tasks, items, lists)[0]).toMatchObject({ kind: 'list' })
    expect(searchAll('buy  PAINT', tasks, items, lists).map((r) => r.kind !== 'list' && r.task.id)).toEqual(['b'])
    expect(searchAll('   ', tasks, items, lists)).toEqual([])
  })
})
