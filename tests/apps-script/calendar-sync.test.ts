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

describe('voice helpers (Alexa)', () => {
  it('tidies what was said into a task title', () => {
    expect((gs.voiceTitle_ as (t: string) => string)('  buy   milk ')).toBe('Buy milk')
    expect((gs.voiceTitle_ as (t: string) => string)('to call the vet')).toBe('Call the vet')
    expect((gs.voiceTitle_ as (t: string) => string)('')).toBe('')
  })
  it('makes a task that copies the list’s privacy and is due today', () => {
    const list = { id: 'inbox', visibility: 'family', ownerId: 'steve', viewerVisible: true, defaultContext: 'family', editAudience: 'family' }
    expect((gs.voiceTaskFields_ as (...a: unknown[]) => object)(list, 'Buy milk', '2026-10-23', 'bot')).toEqual({
      listId: 'inbox', title: 'Buy milk', priority: 2, status: 'todo', context: 'family', durationDays: 1, dependsOn: [], targetDate: '2026-10-23',
      visibility: 'family', ownerId: 'steve', viewerVisible: true, createdBy: 'bot', editAudience: 'family',
    })
  })
  it('leaves the due date off when there is no day (adding to a named list)', () => {
    const list = { id: 'groc', visibility: 'family', ownerId: 'steve', viewerVisible: true, defaultContext: 'family' }
    expect((gs.voiceTaskFields_ as (...a: unknown[]) => Record<string, unknown>)(list, 'Milk', null, 'bot')).not.toHaveProperty('targetDate')
  })
  it('finds the list named after “to” / “on”, or none', () => {
    const lists = [
      { id: 'g', fields: { name: 'Groceries', kind: 'checklist' } },
      { id: 'h', fields: { name: 'Home Depot', kind: 'checklist' } },
      { id: 'b', fields: { name: 'Best Buy Shopping', kind: 'checklist' } },
      { id: 'x', fields: { name: 'Steve’s Christmas List', kind: 'checklist' } },
      { id: 'p', fields: { name: 'Porch walls', kind: 'project' } },
      { id: 'w', fields: { name: 'Work', kind: 'links' } },
      { id: 'i1', fields: { name: 'Inbox', kind: 'list' } },
      { id: 'i2', fields: { name: 'Family Inbox', kind: 'list' } },
    ]
    const target = (t: string) => {
      const r = (gs.voiceTarget_ as (t: string, l: object[]) => { text: string; list: { id: string } } | null)(t, lists)
      return r && [r.text, r.list.id]
    }
    expect(target('milk to groceries')).toEqual(['milk', 'g'])
    expect(target('milk to the grocery list')).toEqual(['milk', 'g'])
    expect(target('eggs and bread to my groceries')).toEqual(['eggs and bread', 'g'])
    expect(target('drill bits on home depot')).toEqual(['drill bits', 'h'])
    expect(target('a new cable to best buy')).toEqual(['a new cable', 'b'])
    expect(target('a sweater to steve’s christmas list')).toEqual(['a sweater', 'x'])
    expect(target('buy primer to porch walls')).toEqual(['buy primer', 'p'])
    expect(target('call mom to inbox')).toEqual(['call mom', 'i1'])
    expect(target('go to the store')).toBeNull()
    expect(target('send the report to work')).toBeNull() // a links list, not for tasks
    expect(target('buy milk')).toBeNull()
  })
  it('says what’s on today', () => {
    const say = gs.voiceSummary_ as (t: object[]) => string
    expect(say([{ title: 'Dentist', calendar: { time: '3:00 PM–4:00 PM' }, status: 'todo' }, { title: 'Buy milk', status: 'todo' }, { title: 'Old', status: 'done' }])).toBe(
      'On the calendar: Dentist at 3:00 PM. To do: Buy milk.',
    )
    expect(say([])).toBe('Nothing on the calendar or the to-do list for today.')
  })
})

describe('location helpers (family map)', () => {
  const point = gs.locationPoint_ as (m: object) => Record<string, number> | null
  const docOf = gs.locationDoc_ as (prev: object | null, p: object) => { lat: number; tst: number; trail: { tst: number }[]; off: boolean; batt?: number }
  it('keeps the parts of an OwnTracks location message Align uses', () => {
    expect(point({ _type: 'location', lat: 28.6012345678, lon: -81.35, acc: 12.4, batt: 80, tst: 1761400000, tid: 'SN', conn: 'w' })).toEqual({
      lat: 28.601235, lon: -81.35, acc: 12, batt: 80, tst: 1761400000000,
    })
    expect(point({ _type: 'transition', lat: 1, lon: 1 })).toBeNull()
    expect(point({ _type: 'location', lat: 95, lon: 1 })).toBeNull()
    expect(point({ _type: 'location', lat: '1', lon: 1 })).toBeNull()
  })
  it('puts the newest point on top and the previous one on the day’s trail', () => {
    const first = docOf(null, { lat: 1, lon: 1, tst: 1000, batt: 50 })
    expect(first).toEqual({ lat: 1, lon: 1, tst: 1000, trail: [], off: false, batt: 50 })
    const second = docOf(first, { lat: 2, lon: 2, tst: 2000 })
    expect(second.lat).toBe(2)
    expect(second.trail).toEqual([{ lat: 1, lon: 1, tst: 1000 }])
    expect(second.batt).toBeUndefined()
  })
  it('drops trail points older than a day, and ignores a late older report', () => {
    const day = 24 * 3600000
    const prev = { lat: 5, lon: 5, tst: 10 * day, trail: [{ lat: 1, lon: 1, tst: 8 * day }, { lat: 4, lon: 4, tst: 9.5 * day }] }
    expect(docOf(prev, { lat: 6, lon: 6, tst: 10.2 * day }).trail.map((t) => t.tst)).toEqual([9.5 * day, 10 * day])
    expect(docOf(prev, { lat: 0, lon: 0, tst: 9 * day }).lat).toBe(5)
  })
})

describe('places and alerts (family map)', () => {
  const changes = gs.placeChanges_ as (prev: object | null, p: object | null, places: object[]) => { inside: string[]; events: { place: string; kind: string }[] }
  const dist = gs.distanceM_ as (a: number, b: number, c: number, d: number) => number
  // Home at (28.6, -81.35), radius 200 m; ~0.0018° latitude ≈ 200 m.
  const home = { id: 'home', fields: { name: 'Home', lat: 28.6, lon: -81.35, radius: 200, createdAt: '2026-01-01T00:00:00Z' } }
  const school = { id: 'school', fields: { name: 'School', lat: 28.65, lon: -81.35, radius: 150, createdAt: '2026-01-01T00:00:00Z' } }
  const at = (lat: number, tst: number, acc = 10) => ({ lat, lon: -81.35, tst, acc })
  const prevAt = (lat: number, tst: number, inside: string[]) => ({ lat, lon: -81.35, tst, inside })
  const t0 = Date.parse('2026-10-26T12:00:00Z')
  it('measures distance', () => {
    expect(Math.round(dist(28.6, -81.35, 28.6018, -81.35))).toBe(200)
  })
  it('notices arriving and leaving, but not on the first report', () => {
    expect(changes(null, at(28.6, t0), [home, school])).toEqual({ inside: ['home'], events: [] })
    expect(changes(prevAt(28.62, t0, []), at(28.6005, t0 + 60000), [home, school]).events).toEqual([{ place: 'home', name: 'Home', kind: 'enter', tst: t0 + 60000 }])
    const left = changes(prevAt(28.6, t0, ['home']), at(28.65, t0 + 60000), [home, school])
    expect(left.inside).toEqual(['school'])
    expect(left.events.map((e) => `${e.kind}:${e.place}`)).toEqual(['leave:home', 'enter:school'])
  })
  it('needs a margin past the edge to count as leaving (no flapping), and ignores poor fixes', () => {
    expect(changes(prevAt(28.6, t0, ['home']), at(28.6020, t0 + 60000), [home]).events).toEqual([]) // 222 m, within 200 + 30
    expect(changes(prevAt(28.6, t0, ['home']), at(28.6030, t0 + 60000), [home]).events.map((e) => e.kind)).toEqual(['leave']) // 333 m
    expect(changes(prevAt(28.6, t0, ['home']), at(28.7, t0 + 60000, 900), [home])).toEqual({ inside: ['home'], events: [] })
  })
  it('stays quiet for a place added since the last report, and drops deleted places', () => {
    const fresh = { ...home, fields: { ...home.fields, createdAt: new Date(t0 + 1000).toISOString() } }
    expect(changes(prevAt(28.62, t0, []), at(28.6, t0 + 60000), [fresh])).toEqual({ inside: ['home'], events: [] })
    expect(changes(prevAt(28.6, t0, ['gone']), null, [home]).inside).toEqual([])
  })
  it('finds who asked to be told, never the person themselves', () => {
    const targets = gs.alertTargets_ as (prefs: object[], uid: string, ev: object) => { id: string }[]
    const prefs = [
      { id: 'steve', fields: { rules: [{ person: 'daughter', place: 'school', enter: true, leave: false }] } },
      { id: 'wife', fields: { rules: [{ person: '*', place: '*', enter: true, leave: true }] } },
      { id: 'daughter', fields: { rules: [{ person: '*', place: '*', enter: true, leave: true }] } },
    ]
    expect(targets(prefs, 'daughter', { place: 'school', kind: 'enter' }).map((p) => p.id)).toEqual(['steve', 'wife'])
    expect(targets(prefs, 'daughter', { place: 'school', kind: 'leave' }).map((p) => p.id)).toEqual(['wife'])
    expect(targets(prefs, 'steve', { place: 'home', kind: 'enter' }).map((p) => p.id)).toEqual(['wife', 'daughter'])
  })
})
