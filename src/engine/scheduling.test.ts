import { describe, expect, it } from 'vitest'
import { addDays, diffDays } from './dates'
import { descendants, topoSort, wouldCreateCycle } from './graph'
import {
  applyPreview,
  conflictOf,
  earliestStart,
  finish,
  meetDate,
  recalculate,
  shiftForward,
  type SchedTask,
} from './scheduling'

const t = (id: string, startDate: string | undefined, durationDays = 1, dependsOn: SchedTask['dependsOn'] = [], targetDate?: string): SchedTask => ({
  id,
  startDate,
  durationDays,
  dependsOn,
  targetDate,
})
const all = () => true
const byId = (tasks: SchedTask[]) => new Map(tasks.map((x) => [x.id, x]))

describe('dates', () => {
  it('adds days across months and DST', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09')
    expect(diffDays('2026-10-01', '2026-10-08')).toBe(7)
  })
})

describe('graph', () => {
  const tasks = [t('a', undefined), t('b', undefined, 1, [{ taskId: 'a', offsetDays: 0 }]), t('c', undefined, 1, [{ taskId: 'b', offsetDays: 0 }])]

  it('rejects cycles, including self-dependency', () => {
    expect(wouldCreateCycle(tasks, 'a', 'c')).toBe(true)
    expect(wouldCreateCycle(tasks, 'a', 'a')).toBe(true)
    expect(wouldCreateCycle(tasks, 'c', 'a')).toBe(false)
  })

  it('sorts prerequisites first', () => {
    expect(topoSort([tasks[2], tasks[0], tasks[1]]).map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })

  it('finds descendants', () => {
    expect([...descendants(tasks, ['a'])].sort()).toEqual(['b', 'c'])
  })
})

describe('earliest start and conflicts', () => {
  // "Apply fertilizer" depends on "Armyworm treatment #2" with +2 (DESIGN.md §6.1).
  const armyworm = t('armyworm', '2026-10-01', 2)
  const fertilize = t('fertilize', '2026-10-04', 1, [{ taskId: 'armyworm', offsetDays: 2 }], '2026-10-06')

  it('computes finish and earliest start', () => {
    expect(finish(armyworm)).toBe('2026-10-02')
    expect(earliestStart(fertilize, byId([armyworm, fertilize]))).toBe('2026-10-05')
  })

  it('flags starting too soon', () => {
    expect(conflictOf(fertilize, byId([armyworm, fertilize]))).toMatch(/before prerequisite/)
  })

  it('flags missing the target date', () => {
    const late = { ...fertilize, startDate: '2026-10-07' }
    expect(conflictOf(late, byId([armyworm, late]))).toMatch(/target date/)
  })

  it('takes the max over several prerequisites and ignores unscheduled ones', () => {
    const x = t('x', '2026-10-01', 5)
    const y = t('y', undefined)
    const z = t('z', '2026-10-20', 1, [
      { taskId: 'armyworm', offsetDays: 0 },
      { taskId: 'x', offsetDays: 1 },
      { taskId: 'y', offsetDays: 0 },
    ])
    expect(earliestStart(z, byId([armyworm, x, y, z]))).toBe('2026-10-07')
  })
})

describe('forward shift', () => {
  const a = t('a', '2026-10-01', 2)
  const b = t('b', '2026-10-05', 1, [{ taskId: 'a', offsetDays: 2 }])
  const c = t('c', '2026-10-10', 1, [{ taskId: 'b', offsetDays: 0 }])
  const unrelated = t('u', '2026-10-01', 1, [{ taskId: 'c', offsetDays: 0 }])

  it('pushes dependents only as far as needed', () => {
    const p = shiftForward([a, b, c], { id: 'a', startDate: '2026-10-04' }, all)
    expect(p.moves).toEqual([
      { id: 'a', from: '2026-10-01', to: '2026-10-04', durationDays: undefined },
      { id: 'b', from: '2026-10-05', to: '2026-10-08' },
    ])
    expect(p.blocked).toEqual([])
  })

  it('cascades through several levels when growing a duration', () => {
    const p = shiftForward([a, b, c], { id: 'a', startDate: '2026-10-01', durationDays: 8 }, all)
    expect(p.moves.map((m) => [m.id, m.to])).toEqual([
      ['a', '2026-10-01'],
      ['b', '2026-10-11'],
      ['c', '2026-10-12'],
    ])
  })

  it('flags tasks the user cannot edit instead of moving them', () => {
    const p = shiftForward([a, b, c], { id: 'a', startDate: '2026-10-04' }, (id) => id !== 'b')
    expect(p.moves.map((m) => m.id)).toEqual(['a'])
    expect(p.blocked.map((x) => x.id)).toEqual(['b'])
  })

  it('leaves non-descendants alone', () => {
    const p = shiftForward([a, b, c, unrelated], { id: 'b', startDate: '2026-10-06' }, all)
    expect(p.moves.map((m) => m.id)).toEqual(['b', 'u'])
  })
})

describe('meet date (backward shift)', () => {
  const a = t('a', '2026-10-01', 2)
  const b = t('b', '2026-10-05', 1, [{ taskId: 'a', offsetDays: 2 }])
  const c = t('c', '2026-10-10', 2, [{ taskId: 'b', offsetDays: 1 }])

  it('pulls prerequisites earlier only as far as needed', () => {
    const p = meetDate([a, b, c], 'c', '2026-10-07', all)
    // c must start Oct 6; b must finish by Oct 4 (start Oct 4); a must finish by Oct 1 (start Sep 30).
    expect(p.moves.map((m) => [m.id, m.to])).toEqual([
      ['c', '2026-10-06'],
      ['b', '2026-10-04'],
      ['a', '2026-09-30'],
    ])
    const after = applyPreview([a, b, c], p)
    expect(after.map((x) => conflictOf(x, byId(after)))).toEqual([undefined, undefined, undefined])
  })

  it('does nothing when the date is already met', () => {
    expect(meetDate([a, b, c], 'c', '2026-10-20', all).moves).toEqual([])
  })

  it('flags prerequisites the user cannot edit', () => {
    const p = meetDate([a, b, c], 'c', '2026-10-07', (id) => id !== 'a')
    expect(p.blocked.map((x) => x.id)).toEqual(['a'])
  })
})

describe('recalculate', () => {
  it('moves tasks that start before their prerequisites and cascades', () => {
    const a = t('a', '2026-10-01', 3)
    const b = t('b', '2026-10-02', 1, [{ taskId: 'a', offsetDays: 0 }])
    const c = t('c', '2026-10-04', 1, [{ taskId: 'b', offsetDays: 0 }])
    expect(recalculate([c, b, a], all).moves.map((m) => [m.id, m.to])).toEqual([
      ['b', '2026-10-04'],
      ['c', '2026-10-05'],
    ])
  })
})
