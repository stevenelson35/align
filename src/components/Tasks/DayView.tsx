import { useState } from 'react'
import { addDays, formatDay, today } from '../../engine/dates'
import { useApp } from '../../hooks/useApp'
import { relativeDay } from '../../utils/day'
import { CalendarActions } from './CalendarActions'
import { HelpTip } from '../UI/HelpTip'
import { Icon } from '../UI/Icon'
import { useWaiting } from '../../hooks/useWaiting'
import { TodayDock } from './TodayDock'
import { DailyGamesButton } from '../Games/DailyGamesButton'
import { TodaySections } from '../../context/TodaySections'
import { panelBackground } from '../../utils/panelStyle'
import { useTodayTiles } from '../../hooks/useTodayTiles'
import { dayTiles, splitMore, type TilePlace } from '../../utils/tiles'
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
  // Add to Today, open and aimed somewhere (the footer's +: the top of Today; a group's +: that group).
  const [adding, setAdding] = useState<TilePlace | null>(null)
  const canArrange = day === now && tiles.canChange
  // Tiles set to show only when something's waiting: the quiet ones wait in More….
  const waiting = useWaiting(tiles.whenNew)
  const quiet = day === now ? main.filter((t) => tiles.whenNew.has(t) && !waiting(t)) : []
  const shownMain = quiet.length ? main.filter((t) => !quiet.includes(t)) : main

  return (
    <section
      className="day-view"
      style={day === now && todayStyle ? { ...panelBackground(todayStyle), borderRadius: 'var(--radius)', padding: '0.5rem' } : undefined}
    >
      <header className="view-header day-header">
        <button type="button" className="link header-icon day-arrow" onClick={() => go(addDays(day, -1))} aria-label="Previous day" title="Previous day">
          <Icon name="chevron-left" />
        </button>
        <h2>
          {todayStyle?.sticker && day === now ? <>{todayStyle.sticker} </> : null}
          {label || formatDay(day)}
          {label && <span className="muted small day-date">{formatDay(day)}</span>}
        </h2>
        <HelpTip topic="today" label="Today" />
        <button type="button" className="link header-icon day-arrow" onClick={() => go(addDays(day, 1))} aria-label="Next day" title="Next day">
          <Icon name="chevron-right" />
        </button>
        {day !== now && (
          <button type="button" className="link small" onClick={() => go(now)}>
            Today
          </button>
        )}
        <span className="grow" />
        {day === now && <DailyGamesButton />}
        {day === now && <CalendarActions />}
      </header>

      {day !== now ? (
        <TodayTiles tiles={dayTiles(tiles.tiles)} day={day} />
      ) : arranging ? (
        <ArrangeTiles onDone={() => setArranging(false)} onAdd={() => setAdding('top')} />
      ) : (
        <TodayTiles tiles={shownMain} day={day} onArrange={canArrange ? () => setArranging(true) : undefined} onAdd={canArrange ? setAdding : undefined} />
      )}
      {adding && <AddToToday start={adding} onClose={() => setAdding(null)} />}
      {day === now && (
        // Not wrapped in a TodaySectionScope: the dock must stay a direct child of .day-view to stick to the bottom.
        <TodayDock
          more={
            <>
              {quiet.length > 0 && (
                <>
                  <p className="muted small today-quiet-note">Nothing new right now (they come back to Home when something arrives):</p>
                  <TodayTiles tiles={quiet} day={day} />
                </>
              )}
              {more.length > 0 && <TodayTiles tiles={more} day={day} onAdd={canArrange ? setAdding : undefined} />}
            </>
          }
          moreCount={more.length + quiet.length}
          onArrange={canArrange ? () => { setArranging(!arranging); window.scrollTo({ top: 0 }) } : undefined}
          arranging={arranging}
          onAdd={canArrange ? () => setAdding('top') : undefined}
        />
      )}
    </section>
  )
}
