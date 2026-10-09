import { describe, expect, it } from 'vitest'
import { fuzzyMatch } from '../utils/fuzzy'
import { parse } from './parser'

const ref = new Date(2026, 9, 1) // Oct 1, 2026 local

describe('parse', () => {
  it('parses the full add example', () => {
    expect(parse('add task fertilize lawn on Oct 5 to Lawn project for work priority high', ref)).toEqual({
      type: 'add',
      title: 'fertilize lawn',
      startDate: '2026-10-05',
      listName: 'Lawn',
      titleWithoutList: 'fertilize lawn to Lawn project',
      context: 'work',
      priority: 1,
    })
  })

  it('parses a bare add with people/pets and a deadline', () => {
    expect(parse('add flea meds for Dog 1 and Cat 2 by tomorrow', ref)).toEqual({
      type: 'add',
      title: 'flea meds',
      targetDate: '2026-10-02',
      forNames: ['Dog 1', 'Cat 2'],
      forText: 'Dog 1 and Cat 2',
    })
  })

  it('keeps the "for ..." text so it can go back in the title, and strips a trailing date from names', () => {
    expect(parse('add task create plan for laundry room door repair', ref)).toEqual({
      type: 'add',
      title: 'create plan',
      forNames: ['laundry room door repair'],
      forText: 'laundry room door repair',
    })
    expect(parse('add flea meds for Dog tomorrow', ref)).toEqual({
      type: 'add',
      title: 'flea meds',
      startDate: '2026-10-02',
      forNames: ['Dog'],
      forText: 'Dog',
    })
  })

  it('reads a trailing date without "on", but keeps "to" in the title when no list matches', () => {
    expect(parse('add take dog to vet tomorrow', ref)).toEqual({
      type: 'add',
      title: 'take dog',
      startDate: '2026-10-02',
      listName: 'vet',
      titleWithoutList: 'take dog to vet',
    })
    expect(parse('add water plants tomorrow', ref)).toEqual({ type: 'add', title: 'water plants', startDate: '2026-10-02' })
  })

  it('rejects an unreadable date', () => {
    expect(parse('add task x on someday soon', ref).type).toBe('error')
  })

  it('parses cancel', () => {
    expect(parse('cancel paint the door', ref)).toEqual({ type: 'cancel', task: 'paint the door' })
    expect(parse('Cancelled paint the door.', ref)).toEqual({ type: 'cancel', task: 'paint the door' })
  })

  it('parses done, move and meet', () => {
    expect(parse('done fertilize lawn', ref)).toEqual({ type: 'done', task: 'fertilize lawn' })
    expect(parse('mark fertilize lawn as done', ref)).toEqual({ type: 'done', task: 'fertilize lawn' })
    expect(parse('move fertilize lawn to Oct 8', ref)).toEqual({ type: 'move', task: 'fertilize lawn', date: '2026-10-08' })
    expect(parse('move drive to airport to Oct 8', ref)).toEqual({ type: 'move', task: 'drive to airport', date: '2026-10-08' })
    expect(parse('shift dependencies so apply fertilizer is done by Oct 10', ref)).toEqual({
      type: 'meet',
      task: 'apply fertilizer',
      date: '2026-10-10',
    })
    expect(parse('meet apply fertilizer by Oct 10', ref)).toEqual({ type: 'meet', task: 'apply fertilizer', date: '2026-10-10' })
  })

  it('parses recalculate, show, vote and help', () => {
    expect(parse('recalculate lawn project', ref)).toEqual({ type: 'recalculate', list: 'lawn' })
    expect(parse('show today', ref)).toEqual({ type: 'show', what: 'today' })
    expect(parse('show work', ref)).toEqual({ type: 'show', what: 'work' })
    expect(parse('show board weekend activities', ref)).toEqual({ type: 'showBoard', board: 'weekend activities' })
    expect(parse('show lawn', ref)).toEqual({ type: 'showNamed', name: 'lawn' })
    expect(parse('vote 3 on tacos in restaurants', ref)).toEqual({ type: 'vote', tokens: 3, item: 'tacos', board: 'restaurants' })
    expect(parse('vote 2 tokens for dinner in a box', ref)).toEqual({ type: 'vote', tokens: 2, item: 'dinner', board: 'a box' })
    expect(parse('vote 1 on pizza', ref)).toEqual({ type: 'vote', tokens: 1, item: 'pizza' })
    expect(parse('help', ref)).toEqual({ type: 'help' })
  })

  it('explains unknown commands', () => {
    expect(parse('dance', ref)).toMatchObject({ type: 'error' })
  })
})

describe('fuzzyMatch', () => {
  const names = ['Fertilize lawn', 'Apply fertilizer', 'Armyworm treatment #1', 'Armyworm treatment #2', 'Mow lawn']
  const match = (q: string) => fuzzyMatch(q, names, (n) => n)

  it('finds a unique match', () => {
    expect(match('fertilize lawn')).toEqual({ kind: 'one', item: 'Fertilize lawn' })
    expect(match('mow')).toEqual({ kind: 'one', item: 'Mow lawn' })
    expect(match('apply fert')).toEqual({ kind: 'one', item: 'Apply fertilizer' })
  })

  it('reports ambiguity', () => {
    expect(match('armyworm')).toEqual({ kind: 'many', items: ['Armyworm treatment #1', 'Armyworm treatment #2'] })
  })

  it('reports no match', () => {
    expect(match('groceries')).toEqual({ kind: 'none' })
  })
})
