/** Google Calendar's day view for 'YYYY-MM-DD' (opens in whichever Google account the browser is signed in to). */
export function googleCalendarDayUrl(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return `https://calendar.google.com/calendar/r/day/${y}/${m}/${d}`
}
