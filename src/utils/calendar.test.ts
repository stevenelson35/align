import { describe, expect, it } from 'vitest'
import { googleCalendarDayUrl } from './calendar'

describe('googleCalendarDayUrl', () => {
  it("opens Google Calendar's day view for a date", () => {
    expect(googleCalendarDayUrl('2026-10-09')).toBe('https://calendar.google.com/calendar/r/day/2026/10/9')
  })
})
