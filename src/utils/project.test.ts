import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { linkProjectTasks, withDependencyChanges } from './project'

const task = (id: string, dependsOn: Task['dependsOn'] = [], listId = 'project') => ({ id, listId, dependsOn }) as Task

describe('project prerequisite sequences', () => {
  it('links in selection order and preserves unrelated dependencies', () => {
    const tasks = [task('a'), task('b', [{ taskId: 'external', offsetDays: 3 }]), task('c'), task('external', [], 'other')]
    const changes = linkProjectTasks(tasks, 'project', ['a', 'b', 'c'])
    expect(changes.map((change) => change.id)).toEqual(['b', 'c'])
    expect(changes[0].after).toEqual([{ taskId: 'external', offsetDays: 3 }, { taskId: 'a', offsetDays: 0 }])
    expect(withDependencyChanges(tasks, changes)[2].dependsOn).toEqual([{ taskId: 'b', offsetDays: 0 }])
    expect(tasks[1].dependsOn).toHaveLength(1)
  })

  it('keeps an existing link and its offset without duplicating it', () => {
    expect(linkProjectTasks([task('a'), task('b', [{ taskId: 'a', offsetDays: 2 }])], 'project', ['a', 'b'])).toEqual([])
  })

  it('rejects direct and transitive cycles without mutating input', () => {
    const tasks = [task('a', [{ taskId: 'c', offsetDays: 0 }]), task('b'), task('c')]
    expect(() => linkProjectTasks(tasks, 'project', ['a', 'b', 'c'])).toThrow('loop')
    expect(tasks[1].dependsOn).toEqual([])
    expect(() => linkProjectTasks([task('a', [{ taskId: 'b', offsetDays: 0 }]), task('b')], 'project', ['a', 'b'])).toThrow('loop')
  })

  it('rejects duplicate, missing and other-project tasks', () => {
    const tasks = [task('a'), task('b', [], 'other')]
    expect(() => linkProjectTasks(tasks, 'project', ['a', 'a'])).toThrow('once')
    expect(() => linkProjectTasks(tasks, 'project', ['a', 'missing'])).toThrow('project')
    expect(() => linkProjectTasks(tasks, 'project', ['a', 'b'])).toThrow('project')
  })
})