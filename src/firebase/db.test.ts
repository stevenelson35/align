import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { List } from '../types'
import { applySchedule, createTask, updateTask, type TaskInput } from './db'

const mocks = vi.hoisted(() => ({
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  batchUpdate: vi.fn(),
  commit: vi.fn(),
}))

vi.mock('./config', () => ({ db: {} }))
vi.mock('../engine/dates', () => ({ today: () => '2026-10-11' }))
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...await importOriginal<typeof import('firebase/firestore')>(),
  collection: (_db: unknown, path: string) => path,
  doc: (...args: unknown[]) => ({ id: 'new-task', path: args.slice(1).join('/') }),
  serverTimestamp: () => 'server-time',
  setDoc: mocks.setDoc,
  getDoc: mocks.getDoc,
  updateDoc: mocks.updateDoc,
  writeBatch: () => ({ update: mocks.batchUpdate, commit: mocks.commit }),
}))

const project: List = { id: 'door', name: 'Door', kind: 'project', visibility: 'private', ownerId: 'steve',
  viewerVisible: false, defaultContext: 'family' }
const input: TaskInput = { title: 'Install door', priority: 2, status: 'todo', context: 'family', durationDays: 1, dependsOn: [] }

beforeEach(() => vi.clearAllMocks())

describe('project task dates', () => {
  it('gives a new project task today without changing its input', async () => {
    await createTask(project, input, 'steve')
    expect(mocks.setDoc.mock.calls[0][1]).toMatchObject({ startDate: '2026-10-11', listId: 'door', ownerId: 'steve' })
    expect(input.startDate).toBeUndefined()
  })

  it('keeps an explicitly selected start date', async () => {
    await createTask(project, { ...input, startDate: '2026-11-01' }, 'steve')
    expect(mocks.setDoc.mock.calls[0][1].startDate).toBe('2026-11-01')
  })

  it('does not schedule checklist items or ordinary list tasks', async () => {
    for (const kind of ['checklist', 'list'] as const) {
      await createTask({ ...project, kind }, input, 'steve')
    }
    expect(mocks.setDoc.mock.calls.every((call) => !('startDate' in call[1]))).toBe(true)
  })

  it('gives an undated task today when moved to a project', async () => {
    mocks.getDoc.mockResolvedValue({ data: () => ({ title: 'Existing task' }) })
    await updateTask('task', {}, project)
    expect(mocks.updateDoc.mock.calls[0][1]).toMatchObject({ startDate: '2026-10-11', listId: 'door' })
  })

  it('keeps an existing date when moved to a project', async () => {
    mocks.getDoc.mockResolvedValue({ data: () => ({ startDate: '2026-11-05' }) })
    await updateTask('task', {}, project)
    expect(mocks.updateDoc.mock.calls[0][1].startDate).toBe('2026-11-05')
  })

  it('keeps an explicitly changed date when moved to a project', async () => {
    await updateTask('task', { startDate: '2026-12-01' }, project)
    expect(mocks.getDoc).not.toHaveBeenCalled()
    expect(mocks.updateDoc.mock.calls[0][1].startDate).toBe('2026-12-01')
  })
})

describe('prerequisite batches', () => {
  it('writes prerequisite links, dates and conflict flags together', async () => {
    const after = [{ taskId: 'buy', offsetDays: 0 }]
    await applySchedule([{ id: 'install', from: '2026-10-11', to: '2026-10-12' }], new Map([['install', undefined]]),
      [{ id: 'install', before: [], after }])
    expect(mocks.batchUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.batchUpdate.mock.calls[0][1]).toMatchObject({ startDate: '2026-10-12', dependsOn: after })
    expect(mocks.commit).toHaveBeenCalledTimes(1)
  })

  it('can write links without any date moves', async () => {
    await applySchedule([], new Map(), [{ id: 'install', before: [], after: [{ taskId: 'buy', offsetDays: 0 }] }])
    expect(mocks.batchUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.batchUpdate.mock.calls[0][1]).not.toHaveProperty('startDate')
  })
})