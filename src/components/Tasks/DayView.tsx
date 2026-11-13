import { useState } from 'react'
import { addDays, formatDay, today } from '../../engine/dates'
import { useApp } from '../../hooks/useApp'
import { relativeDay } from '../../utils/day'
import { CalendarActions } from './CalendarActions'
import { HelpTip } from '../UI/HelpTip'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { useWeather } from '../../hooks/useWeather'
import { WeatherButton, WeatherRow } from './TodayWeather'
import { TodayDock } from './TodayDock'
import { TodaySections } from '../../context/TodaySections'
import { panelBackground } from '../../utils/panelStyle'
import { useTodayTiles } from '../../hooks/useTodayTiles'
import { dayTiles, splitMore } from '../../utils/tiles'
import { TodayTiles } from '../Today/TodayTiles'
import { ArrangeTiles } from '../Today/ArrangeTiles'
import { AddToToday } from '../Today/AddToToday'

/**
 * One day (DESIGN.md §8, §13 phase 3): today is the start page, your tiles in your order (panels, lists, entries,
 * parts of panels, under groups you name), the rest folded into More…; ‹ › go to other days, which show what
 * belongs to a day (To Do with what got done, skipped or pushed; goals; archive pictures; The Daily).
 */
export function DayView({ day }: { day: string }) {
  return <TodaySections><DayContents day={day} /></TodaySections>
}

function DayContents({ day }: { day: string }) {
  const app = useApp()
  const todayStyle = app.member.todayPanels?.today
  const now = today()
  const label = relativeDay(day, now)
  const go = (d: string) => app.navigate(d === now ? { view: 'today' } : { view: 'day', day: d })
  const tiles = useTodayTiles()
  const { main, more } = splitMore(tiles.tiles)
  const [arranging, setArranging] = useState(false)
  const [adding, setAdding] = useState(false)
  const canArrange = day === now && tiles.canChange
  const [weatherOpen, setWeatherOpen] = useStoredFlag('align-weather-open', false)
  const { weather, error: weatherError, place: weatherPlace, settings: weatherSettings } = useWeather(day === now)

  return (
    <section
      className="day-view"
      style={day === now && todayStyle ? { ...panelBackground(todayStyle), borderRadius: 'var(--radius)', padding: '0.5rem' } : undefined}
    >
      <header className="view-header day-header">
        <button type="button" className="secondary small" onClick={() => go(addDays(day, -1))} aria-label="Previous day" title="Previous day">
          ‹
        </button>
        <h2>
          {todayStyle?.sticker && day === now ? <>{todayStyle.sticker} </> : null}
          {label || formatDay(day)}
          {label && <span className="muted small day-date"> {formatDay(day)}</span>}
        </h2>
        <HelpTip topic="today" label="Today" />
        <button type="button" className="secondary small" onClick={() => go(addDays(day, 1))} aria-label="Next day" title="Next day">
          ›
        </button>
        {day === now && <WeatherButton weather={weather} place={weatherPlace} open={weatherOpen} onToggle={() => setWeatherOpen(!weatherOpen)} />}
        {day !== now && (
          <button type="button" className="link small" onClick={() => go(now)}>
            Today
          </button>
        )}
        <span className="grow" />
        {day === now && <CalendarActions />}
      </header>
      {day === now && weatherOpen && <WeatherRow weather={weather} error={weatherError} place={weatherPlace} settings={weatherSettings} />}

      {day !== now ? (
        <TodayTiles tiles={dayTiles(tiles.tiles)} day={day} />
      ) : arranging ? (
        <ArrangeTiles onDone={() => setArranging(false)} onAdd={() => setAdding(true)} />
      ) : (
        <TodayTiles tiles={main} day={day} onArrange={canArrange ? () => setArranging(true) : undefined} />
      )}
      {adding && <AddToToday onClose={() => setAdding(false)} />}
      {day === now && (
        // Not wrapped in a TodaySectionScope: the dock must stay a direct child of .day-view to stick to the bottom.
        <TodayDock
          more={<TodayTiles tiles={more} day={day} />}
          moreCount={more.length}
          onArrange={canArrange ? () => { setArranging(!arranging); window.scrollTo({ top: 0 }) } : undefined}
          arranging={arranging}
          onAdd={canArrange ? () => setAdding(true) : undefined}
        />
      )}
    </section>
  )
}
