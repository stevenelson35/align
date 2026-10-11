// Unit tests for the pure helpers in the Apps Script calendar sync. The .gs file is plain JS, loaded into a sandbox.
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

type Fn = (...args: never[]) => unknown
const gs: Record<string, Fn> = createContext({}) as Record<string, Fn>
runInContext(readFileSync('scripts/apps-script/calendar-sync.gs', 'utf8'), gs)

// Format in UTC so tests don't depend on the machine's zone (the script uses the calendar's zone).
const fmt = {
  day: (d: Date) => d.toISOString().slice(0, 10),
  time: (d: Date) => d.toISOString().slice(11, 16),
}
const eventToTask = (ev: object) => (gs.eventToTask_ as (ev: object, f: typeof fmt) => { docId: string; fields: Record<string, unknown> })(ev, fmt)

describe('eventToTask_', () => {
  it('maps a timed event with location', () => {
    expect(
      eventToTask({
        id: 'abc123',
        summary: 'Vet: Dog 1',
        start: { dateTime: '2026-10-12T15:00:00Z' },
        end: { dateTime: '2026-10-12T15:30:00Z' },
        location: 'Main St Vet',
      }),
    ).toEqual({
      docId: 'gcal_abc123',
      fields: {
        title: 'Vet: Dog 1',
        startDate: '2026-10-12',
        durationDays: 1,
        calendar: { eventId: 'abc123', time: '15:00–15:30', location: 'Main St Vet' },
      },
    })
  })

  it('treats all-day end dates as exclusive', () => {
    const one = eventToTask({ id: 'b', summary: 'Birthday', start: { date: '2026-10-20' }, end: { date: '2026-10-21' } })
    expect(one.fields).toEqual({ title: 'Birthday', startDate: '2026-10-20', durationDays: 1, calendar: { eventId: 'b' } })
    const trip = eventToTask({ id: 'c', summary: 'Trip', start: { date: '2026-10-30' }, end: { date: '2026-11-02' } })
    expect(trip.fields).toMatchObject({ startDate: '2026-10-30', durationDays: 3 })
  })

  it('keys on the event id (stable when moved; recurring instances have their own ids)', () => {
    const before = eventToTask({ id: 'r_20261012T170000Z', summary: 'Piano', start: { dateTime: '2026-10-12T17:00:00Z' }, end: { dateTime: '2026-10-12T18:00:00Z' } })
    const moved = eventToTask({ id: 'r_20261012T170000Z', summary: 'Piano', start: { dateTime: '2026-10-13T17:00:00Z' }, end: { dateTime: '2026-10-13T18:00:00Z' } })
    expect(moved.docId).toBe(before.docId)
    expect(before.docId).toBe('gcal_r_20261012T170000Z')
  })

  it("keeps the event's Google Calendar link", () => {
    const ev = { id: 'v', summary: 'Vet', start: { date: '2026-10-20' }, end: { date: '2026-10-21' }, htmlLink: 'https://www.google.com/calendar/event?eid=abc' }
    expect(eventToTask(ev).fields.calendar).toEqual({ eventId: 'v', link: 'https://www.google.com/calendar/event?eid=abc' })
  })

  it('names untitled events', () => {
    expect(eventToTask({ id: 'x', start: { date: '2026-10-01' }, end: { date: '2026-10-02' } }).fields.title).toBe('(no title)')
  })
})

describe('sameSynced_', () => {
  const same = gs.sameSynced_ as (a: object, b: object) => boolean
  it('ignores the key order of the calendar map (Firestore may return it differently)', () => {
    const a = { title: 'T', startDate: '2026-10-20', durationDays: 1, calendar: { eventId: 'e', time: '9:00 AM', link: 'L' } }
    const b = { title: 'T', startDate: '2026-10-20', durationDays: 1, calendar: { link: 'L', eventId: 'e', time: '9:00 AM' } }
    expect(same(a, b)).toBe(true)
    expect(same(a, { ...b, calendar: { ...b.calendar, link: 'other' } })).toBe(false)
  })
})

describe('planSync_', () => {
  const w = (id: string, startDate: string, title = 'T') => ({ docId: id, fields: { title, startDate, durationDays: 1, calendar: { eventId: id } } })
  const have = (id: string, startDate: string, extra: object = {}) => ({ id, fields: { ...w(id, startDate).fields, status: 'todo', ...extra } })
  const plan = (wanted: object[], existing: object[]) =>
    gs.planSync_(wanted as never, existing as never, '2026-10-01' as never, '2026-11-30' as never) as { creates: { docId: string }[]; updates: { docId: string }[]; deletes: string[] }

  it('creates new events, updates changed ones and leaves unchanged ones alone', () => {
    const p = plan([w('new', '2026-10-10'), w('moved', '2026-10-15'), w('same', '2026-10-12')], [have('moved', '2026-10-14'), have('same', '2026-10-12', { status: 'done' })])
    expect(p.creates.map((x) => x.docId)).toEqual(['new'])
    expect(p.updates.map((x) => x.docId)).toEqual(['moved'])
    expect(p.deletes).toEqual([])
  })

  it('deletes cancelled events only inside the window, and never hand-made tasks', () => {
    const handMade = { id: 'manual', fields: { title: 'Buy cake', startDate: '2026-10-20', durationDays: 1 } }
    const p = plan([], [have('cancelled', '2026-10-20'), have('old', '2026-09-01'), handMade])
    expect(p.deletes).toEqual(['cancelled'])
  })
})

describe('Firestore value encoding', () => {
  it('round-trips the task shapes Align stores', () => {
    const task = { title: 'x', durationDays: 2, viewerVisible: false, dependsOn: [], calendar: { key: 'k', time: '9:00 AM' }, skip: undefined }
    const fields = gs.toFields_(task as never)
    expect(fields).toMatchObject({ durationDays: { integerValue: '2' }, dependsOn: { arrayValue: { values: [] } } })
    expect(gs.fromFields_(fields as never)).toEqual({ title: 'x', durationDays: 2, viewerVisible: false, dependsOn: [], calendar: { key: 'k', time: '9:00 AM' } })
  })
})

describe('config_', () => {
  it('requires the five settings and fills in defaults', () => {
    expect(() => gs.config_({} as never)).toThrow(/CALENDAR_ID/)
    const cfg = gs.config_({ CALENDAR_ID: 'c', FIREBASE_API_KEY: 'k', FIREBASE_PROJECT_ID: 'p', BOT_EMAIL: 'e', BOT_PASSWORD: 'pw' } as never)
    expect(cfg).toMatchObject({ WEEKS_AHEAD: '8', LIST_NAME: 'Family Calendar', LIST_ID: '' })
  })
})
