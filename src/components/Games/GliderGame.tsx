import { useCallback, useEffect, useRef, useState } from 'react'
import { DAILY_EARNERS, doneToday, EARN, MAX_PLAY_SECONDS, MIN_ROUND, playClock, spendPlay, useGliderBoard, usePlay, type Play } from '../../firebase/play'
import { today } from '../../engine/dates'
import { flap, H, newWorld, PLANE_R, PLANE_X, step, TOWER, W, type World } from '../../games/glider'
import { useApp, useData } from '../../hooks/useApp'
import { useDailySettings, type DailyItem } from '../../daily/settings'
import { Icon } from '../UI/Icon'

type Phase = 'ready' | 'flying' | 'crashed'

/** Spent time is saved this often while flying (and at every crash), so a closed tab loses little. */
const SAVE_EVERY = 10

/**
 * Glider (DESIGN.md §5.16): tap (or Space) to keep the paper plane up between the cloud towers. Flying uses your play
 * time, earned by learning; when it runs out, the game shows where to earn more.
 */
export function GliderGame({ onBack }: { onBack: () => void }) {
  const app = useApp()
  const play = usePlay(app.uid, app.canPlay)
  const canvas = useRef<HTMLCanvasElement>(null)
  const world = useRef<World>(newWorld())
  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  // Time flown but not yet saved (seconds), and, while flying, the screen's own count of what's left (between runs,
  // the saved balance, which also shows time earned elsewhere).
  const unsaved = useRef(0)
  const [left, setLeft] = useState(0)
  const leftRef = useRef(0)
  const phaseRef = useRef<Phase>('ready')
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])
  const shownLeft = phase === 'flying' ? left : (play?.seconds ?? 0)

  const save = useCallback(
    (finalScore = 0) => {
      const used = Math.round(unsaved.current)
      unsaved.current -= used
      if (used > 0 || finalScore > 0) void spendPlay(app.uid, used, finalScore, today()).catch(() => undefined)
    },
    [app.uid],
  )

  // The loop: move, draw, count time while flying.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let sinceSave = 0
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (phaseRef.current === 'flying') {
        world.current = step(world.current, dt)
        unsaved.current += dt
        sinceSave += dt
        leftRef.current = Math.max(0, leftRef.current - dt)
        setLeft(leftRef.current)
        setScore(world.current.score)
        // A crash, or the play time running out mid-flight, ends the run.
        if (world.current.over || leftRef.current <= 0) {
          phaseRef.current = 'crashed'
          setPhase('crashed')
          save(world.current.score)
          sinceSave = 0
        } else if (sinceSave >= SAVE_EVERY) {
          save()
          sinceSave = 0
        }
      }
      draw(canvas.current, world.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [save])

  // Leaving the page saves what was flown.
  useEffect(() => () => save(), [save])

  const tap = useCallback(() => {
    if (!play) return
    if (phaseRef.current === 'flying') {
      world.current = flap(world.current)
      return
    }
    if (play.seconds <= 0) return
    world.current = flap(newWorld())
    setScore(0)
    leftRef.current = play.seconds
    setLeft(play.seconds)
    phaseRef.current = 'flying'
    setPhase('flying')
  }, [play])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        tap()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [tap])

  if (!app.canPlay) return <p className="muted">Glider is for the family.</p>
  if (!play) return <p className="muted">Getting your play time…</p>
  const out = shownLeft <= 0 && phase !== 'flying'

  return (
    <section className="glider">
      <header className="view-header">
        <h2>
          <Icon name="sparkle" /> Glider
        </h2>
        <span className="grow" />
        <button type="button" className="link small" onClick={onBack}>
          All games
        </button>
      </header>
      <div className="row glider-status">
        <span className={`glider-time${shownLeft < 15 ? ' low' : ''}`}>
          <Icon name="clock" /> {playClock(shownLeft)} left
        </span>
        <span className="grow" />
        <span>Score {score}</span>
        <span className="muted">Best {Math.max(play.best, score)}</span>
      </div>
      <div className="glider-stage">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          className="glider-canvas"
          onPointerDown={(e) => {
            e.preventDefault()
            tap()
          }}
          aria-label="Glider: tap to fly"
        />
        {phase !== 'flying' && !out && (
          <button type="button" className="glider-overlay" onClick={tap}>
            {phase === 'crashed' ? (
              <>
                <strong>Score {score}</strong>
                <span>Tap to fly again</span>
              </>
            ) : (
              <>
                <strong>Tap to fly</strong>
                <span>Tap (or Space) to lift the plane through the gaps. The clock runs only while you fly.</span>
              </>
            )}
          </button>
        )}
        {out && (
          <div className="glider-overlay out">
            <strong>Out of play time</strong>
            <span>Learn something to earn more: see below.</span>
          </div>
        )}
      </div>
      <GliderBoard />
      <EarnMore emphasize={out} play={play} />
    </section>
  )
}

/** The family's best scores, highest first. */
function GliderBoard() {
  const app = useApp()
  const board = useGliderBoard(app.canPlay)
  const rows = Object.entries(board)
    .filter(([uid]) => app.household.members[uid])
    .sort((a, b) => b[1].best - a[1].best)
  return (
    <div className="glider-board">
      <h3>
        <Icon name="star" /> Family best
      </h3>
      {rows.length ? (
        <ol>
          {rows.map(([uid, r]) => (
            <li key={uid} className={uid === app.uid ? 'me' : ''}>
              <span className="grow">{app.household.members[uid].displayName}</span> <strong>{r.best}</strong> <span className="muted small">{r.at}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted small">No scores yet: be the first.</p>
      )}
    </div>
  )
}

/**
 * Where to earn play time, as a list of things to do with a tap each: today's Daily items and Wordle of the day (✓ once
 * done today), flashcard sets (a round, or a Challenge), and the periodic table's elements you haven't opened.
 */
export function EarnMore({ emphasize = false, play }: { emphasize?: boolean; play: Play }) {
  const app = useApp()
  const { lists, listItems } = useData()
  const done = doneToday(play.daily, today())
  // Only the Daily items you show (Settings → The Daily).
  const dailySettings = useDailySettings()
  const sets = lists
    .filter((l) => l.kind === 'cards')
    .map((l) => ({ l, n: listItems.filter((t) => t.listId === l.id).length }))
    .filter((x) => x.n >= MIN_ROUND)
    .sort((a, b) => a.l.name.localeCompare(b.l.name))
  const unseen = 118 - play.seen.length
  const item = (key: string, label: string, earns: string, go: () => void, isDone = false) => (
    <li key={key} className={isDone ? 'done' : ''}>
      <button type="button" className="link" onClick={go} disabled={isDone}>
        {isDone ? <Icon name="check" /> : null} {label}
      </button>{' '}
      <span className="muted small">{isDone ? 'done today' : earns}</span>
    </li>
  )
  return (
    <div className={`earn-more${emphasize ? ' emphasize' : ''}`}>
      <h3>
        <Icon name="star" /> Earn play time
      </h3>
      <p className="muted small">Pick something to learn; the time is added as soon as you finish it. You can hold up to {playClock(MAX_PLAY_SECONDS)}.</p>
      <h4 className="small">Today</h4>
      <ul className="earn-list">
        {DAILY_EARNERS.filter((d) => d.id === 'wordle' || !dailySettings.hidden.has(d.id as DailyItem)).map((d) =>
          item(d.id, d.label, `+${d.seconds < 60 ? `${d.seconds} s` : playClock(d.seconds)}`, () => app.navigate(d.id === 'wordle' ? { view: 'games', gameId: 'wordle' } : { view: 'daily' }), done.includes(d.id)),
        )}
      </ul>
      {sets.length > 0 && (
        <>
          <h4 className="small">Flashcards</h4>
          <p className="muted small">
            A round of {MIN_ROUND}+ cards: +{playClock(EARN.round)} and {EARN.perCard} s more a card after {MIN_ROUND}; a Challenge round: +{playClock(EARN.challenge)}.
          </p>
          <ul className="earn-list">{sets.map(({ l, n }) => item(l.id, l.name, `${n} cards`, () => app.navigate({ view: 'list', listId: l.id, timeline: false })))}</ul>
        </>
      )}
      <h4 className="small">Explore</h4>
      <ul className="earn-list">
        {item('elements', 'The periodic table', unseen > 0 ? `+${EARN.element} s for each new element (${unseen} to discover)` : 'all discovered', () => app.navigate({ view: 'elements' }), unseen <= 0)}
      </ul>
    </div>
  )
}

// ---- Drawing ----

function draw(c: HTMLCanvasElement | null, w: World) {
  const g = c?.getContext('2d')
  if (!c || !g) return
  // Sky.
  const sky = g.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#7cc4f5')
  sky.addColorStop(1, '#dff1ff')
  g.fillStyle = sky
  g.fillRect(0, 0, W, H)
  // Far hills, for depth.
  g.fillStyle = '#b9e3c6'
  g.beginPath()
  g.moveTo(0, H)
  for (let x = 0; x <= W; x += 40) g.lineTo(x, H - 40 - 18 * Math.sin((x + w.towers[0].x) / 60))
  g.lineTo(W, H)
  g.fill()
  // Cloud towers: soft white columns with puffy ends at the gap.
  for (const t of w.towers) {
    const top = t.gapY - TOWER.gap / 2
    const bottom = t.gapY + TOWER.gap / 2
    cloudColumn(g, t.x, 0, TOWER.width, top, 'down')
    cloudColumn(g, t.x, bottom, TOWER.width, H - bottom, 'up')
  }
  // The paper plane, tilted with its speed.
  g.save()
  g.translate(PLANE_X, w.y)
  g.rotate(Math.max(-0.5, Math.min(0.8, w.vy / 700)))
  g.fillStyle = '#ffffff'
  g.strokeStyle = '#33506e'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(PLANE_R + 6, 0)
  g.lineTo(-PLANE_R, -PLANE_R + 2)
  g.lineTo(-PLANE_R + 6, 0)
  g.lineTo(-PLANE_R, PLANE_R - 2)
  g.closePath()
  g.fill()
  g.stroke()
  g.beginPath()
  g.moveTo(PLANE_R + 6, 0)
  g.lineTo(-PLANE_R + 6, 0)
  g.stroke()
  g.restore()
}

function cloudColumn(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, puff: 'up' | 'down') {
  if (h <= 0) return
  g.fillStyle = '#fbfdff'
  g.strokeStyle = '#a9c4dc'
  g.lineWidth = 2
  g.beginPath()
  g.rect(x, y, w, h)
  g.fill()
  g.stroke()
  // Puffs along the open end.
  const edge = puff === 'down' ? y + h : y
  for (let i = 0; i < 3; i++) {
    g.beginPath()
    g.arc(x + w * (0.2 + i * 0.3), edge, w * 0.22, 0, Math.PI * 2)
    g.fill()
    g.stroke()
  }
  g.fillRect(x + 1, puff === 'down' ? edge - w * 0.2 : edge, w - 2, w * 0.2)
}
