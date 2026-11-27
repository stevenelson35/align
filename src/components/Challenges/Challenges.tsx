import { useMemo, useState, type FormEvent } from 'react'
import { today } from '../../engine/dates'
import { checkIn, createChallenge, leaveChallenge, savePlayer, setChallengeStatus, setLog, updateChallenge, useChallenges } from '../../firebase/challenges'
import { createGoal, logGoal } from '../../firebase/db'
import { sendToInbox } from '../../firebase/inbox'
import { useApp, useData } from '../../hooks/useApp'
import { useStoredSet } from '../../hooks/useStoredSet'
import { useTodayExpansion } from '../../hooks/useTodaySection'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import type { Goal } from '../../types'
import { celebrate } from '../../utils/celebrate'
import {
  allFinished,
  checkedInOn,
  current,
  GOAL_ICONS,
  milestonesPassed,
  overtaken,
  parseValue,
  PLAYER_COLORS,
  PLAYER_ICONS,
  ranked,
  series,
  trackPositions,
  type Challenge,
  type ChallengePlayer,
} from '../../utils/challenges'
import { canLogGoal } from '../../utils/tasks'
import { Icon } from '../UI/Icon'
import { SectionHeader } from '../UI/SectionHeader'

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

/**
 * Home's Challenges (below the Inbox): an invitation to answer, then each challenge you're in as one line (the track:
 * everyone's icon placed at their percent of their own goal), opening to the bars, your check-in and more. Nothing
 * shows when you're in none (start one on the Challenges page, in the Library).
 */
export function ChallengesPanel() {
  const app = useApp()
  const all = useChallenges(app.uid, app.canPlay)
  const invites = all.filter((c) => c.status === 'active' && !c.players[app.uid])
  const active = all.filter((c) => c.status === 'active' && c.players[app.uid])
  if (!invites.length && !active.length) return null
  return (
    <div className="day-section challenges-panel">
      {invites.map((c) => (
        <Invitation key={c.id} c={c} />
      ))}
      {active.map((c) => (
        <ChallengeCard key={c.id} c={c} />
      ))}
    </div>
  )
}

/** The Challenges page (#/challenges): start one, the ones you're in, and past ones (history). */
export function ChallengesView() {
  const app = useApp()
  const all = useChallenges(app.uid, app.canPlay)
  const [making, setMaking] = useState(false)
  const invites = all.filter((c) => c.status === 'active' && !c.players[app.uid])
  const active = all.filter((c) => c.status === 'active' && c.players[app.uid])
  const past = all.filter((c) => c.status === 'ended').sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''))
  return (
    <section className="challenges-view">
      <header className="view-header">
        <h2>
          <Icon name="trophy" /> Challenges
        </h2>
        <span className="grow" />
        {app.canPlay && !making && (
          <button type="button" className="secondary small" onClick={() => setMaking(true)}>
            <Icon name="plus" /> New challenge
          </button>
        )}
      </header>
      <p className="muted small">A race to each person’s own goal, measured in percent of it, so different goals compare fairly. Each challenge shows on Home for everyone in it.</p>
      {making && <NewChallenge onDone={() => setMaking(false)} />}
      <div className="challenges-panel">
        {invites.map((c) => (
          <Invitation key={c.id} c={c} />
        ))}
        {active.map((c) => (
          <ChallengeCard key={c.id} c={c} startOpen />
        ))}
      </div>
      {!active.length && !invites.length && !making && <p className="muted small">No challenges yet.</p>}
      {past.length > 0 && (
        <>
          <h3 className="small muted">Past challenges</h3>
          <div className="challenges-panel">
            {past.map((c) => (
              <ChallengeCard key={c.id} c={c} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

/** The one-line track: 0% on the left, the finish on the right, everyone's icon where they are. */
function Track({ c }: { c: Challenge }) {
  const spots = trackPositions(c)
  const lanes = Math.max(1, ...spots.map((s) => s.lane + 1))
  return (
    <div className="challenge-track" style={{ height: `${0.9 + lanes * 1.25}rem` }} aria-hidden="true">
      <span className="challenge-track-line" />
      <span className="challenge-track-goal">{c.goalIcon}</span>
      {spots.map((s) => (
        <span key={s.uid} className="challenge-track-icon" style={{ left: `calc(${s.pct}% * 0.9)`, bottom: `${0.1 + s.lane * 1.25}rem`, borderColor: c.players[s.uid].color }} title={`${c.players[s.uid].nickname}: ${s.pct}%`}>
          {c.players[s.uid].icon}
        </span>
      ))}
    </div>
  )
}

function ChallengeCard({ c, startOpen = false }: { c: Challenge; startOpen?: boolean }) {
  const app = useApp()
  const { goals } = useData()
  const [openSet, toggleOpen] = useStoredSet('align-challenges-open')
  const [stored, saveStored] = useStoredFlag(`align-challenge-${c.id}`, startOpen)
  const setOpenFlag = useTodayExpansion(stored, saveStored)
  const open = startOpen ? !openSet.has(`closed:${c.id}`) : stored
  const setOpen = (v: boolean) => (startOpen ? toggleOpen(`closed:${c.id}`) : setOpenFlag(v))
  const [logging, setLogging] = useState(false)
  const [value, setValue] = useState('')
  const [graph, setGraph] = useState(false)
  const [editing, setEditing] = useState<'me' | 'challenge' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nudged, setNudged] = useState<Set<string>>(() => new Set())
  const me = c.players[app.uid]
  const mine = c.createdBy === app.uid
  const ended = c.status === 'ended'
  const leader = ranked(c)[0]
  const others = Object.keys(c.players).filter((id) => id !== app.uid)
  const day = today()

  async function record(e: FormEvent) {
    e.preventDefault()
    const v = parseValue(value)
    if (v === null || !me) return setError('Type a number, like 195.')
    setBusy(true)
    setError(null)
    try {
      const before = current(me)
      const passed = overtaken(c, app.uid, v)
      const marks = milestonesPassed(me, before, v)
      await checkIn(c.id, app.uid, v)
      // The same number on your linked goal (a measure), for today.
      const goal = me.goalId ? goals.find((g) => g.id === me.goalId) : undefined
      if (goal && canLogGoal(goal, app.uid, app.member.role)) await logGoal(goal.id, day, { value: v }, app.uid).catch(() => undefined)
      setValue('')
      setLogging(false)
      const after = { ...c, players: { ...c.players, [app.uid]: { ...me, log: [...(me.log ?? []), { at: new Date().toISOString(), v }] } } }
      const leading = ranked(after)[0]?.uid === app.uid && ranked(c)[0]?.uid !== app.uid
      // Celebrate here; tell the others the big news.
      if (allFinished(after) && !allFinished(c)) celebrate({ done: 1, total: 1, message: `Everyone reached their goal! ${c.goalIcon}` })
      else if (marks.length) celebrate({ done: marks[marks.length - 1], total: 100, message: marks.includes(100) ? `You reached your goal! ${c.goalIcon}` : `${marks[marks.length - 1]}% of the way!` })
      else if (leading) celebrate({ done: 1, total: 1, message: 'You’ve taken the lead!' })
      const news: Promise<unknown>[] = []
      if (marks.length) news.push(sendToInbox(app.uid, others, { kind: 'challenge', title: marks.includes(100) ? `reached their goal in ${c.title} ${c.goalIcon}` : `reached ${marks[marks.length - 1]}% in ${c.title}`, link: '#/challenges' }))
      if (passed.length) news.push(sendToInbox(app.uid, passed, { kind: 'challenge', title: `passed you in ${c.title}`, link: '#/challenges' }))
      void Promise.all(news).catch(() => undefined)
    } catch (err) {
      setError(errorText(err))
    }
    setBusy(false)
  }

  async function nudge(uid: string) {
    try {
      await sendToInbox(app.uid, [uid], { kind: 'challenge', title: `sent a nudge: time to check in for ${c.title}`, link: '#/challenges' })
      setNudged((n) => new Set(n).add(uid))
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <article className={`challenge-card${ended ? ' ended' : ''}`}>
      <SectionHeader icon="trophy" title={c.title} onTitleClick={() => setOpen(!open)} expanded={open} help="challenges" beside={!open && leader ? <span className="muted small tile-status">{`${c.players[leader.uid].nickname} leads · ${leader.pct}%`}</span> : undefined}>
        <button type="button" className="link small" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'}
        </button>
      </SectionHeader>
      <div className="tile-body">
        <Track c={c} />
        {open && (
          <div className="challenge-detail">
            <p className="muted small">Progress is each person’s percent of their own goal.{ended ? ' This challenge has ended.' : ''}</p>
            {ranked(c).map(({ uid, p, pct }) => (
              <div key={uid} className="challenge-row">
                <div className="challenge-row-head">
                  {uid === app.uid && !ended ? (
                    <button type="button" className="link challenge-name" onClick={() => setLogging(!logging)} aria-expanded={logging} title="Record a new value">
                      {p.nickname} <Icon name="edit" />
                    </button>
                  ) : (
                    <strong className="challenge-name">{p.nickname}</strong>
                  )}
                  <span className="muted small">
                    {fmt(current(p))} {c.unit} → {fmt(p.goal)}
                  </span>
                  {uid !== app.uid && !ended && !checkedInOn(p, day) && (
                    <button type="button" className="link small" disabled={nudged.has(uid)} onClick={() => void nudge(uid)} title="They haven’t checked in today">
                      {nudged.has(uid) ? 'Nudged' : 'Nudge'}
                    </button>
                  )}
                  <span className="grow" />
                  <strong style={{ color: p.color }}>{pct}%</strong>
                </div>
                <div className="challenge-bar-row">
                  <span className="challenge-bar-icon">{p.icon}</span>
                  <span className="challenge-bar">
                    <span style={{ width: `${pct}%`, background: p.color }} />
                  </span>
                  <span className="challenge-bar-icon">{c.goalIcon}</span>
                </div>
                {uid === app.uid && logging && (
                  <form className="challenge-log row" onSubmit={record}>
                    <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={`Today’s ${c.unit || 'value'} (now ${fmt(current(p))})`} aria-label="New value" autoFocus />
                    <button type="submit" className="small" disabled={busy || !value.trim()}>
                      {busy ? 'Saving…' : 'Save'}
                    </button>
                    {(p.log?.length ?? 0) > 0 && (
                      <button type="button" className="link small" onClick={() => void setLog(c.id, app.uid, p.log!.slice(0, -1)).catch((err) => setError(errorText(err)))} title={`Take back ${fmt(p.log![p.log!.length - 1].v)}`}>
                        Undo last
                      </button>
                    )}
                  </form>
                )}
              </div>
            ))}
            {error && <p className="error small">{error}</p>}
            <div className="row wrap challenge-actions">
              <button type="button" className="link small" onClick={() => setGraph(!graph)} aria-expanded={graph}>
                <Icon name={graph ? 'chevron-down' : 'chevron-right'} /> Graph
              </button>
              {me && !ended && (
                <button type="button" className="link small" onClick={() => setEditing(editing === 'me' ? null : 'me')}>
                  My settings
                </button>
              )}
              {mine && (
                <button type="button" className="link small" onClick={() => setEditing(editing === 'challenge' ? null : 'challenge')}>
                  Edit challenge
                </button>
              )}
              {!mine && me && !ended && (
                <button type="button" className="link small" onClick={() => window.confirm(`Leave “${c.title}”?`) && void leaveChallenge(c, app.uid).catch((err) => setError(errorText(err)))}>
                  Leave
                </button>
              )}
            </div>
            {graph && <ChallengeGraph c={c} />}
            {editing === 'me' && me && <PlayerForm c={c} player={me} onDone={() => setEditing(null)} />}
            {editing === 'challenge' && <ChallengeSettings c={c} onDone={() => setEditing(null)} />}
          </div>
        )}
      </div>
    </article>
  )
}

/** Everyone's check-ins over time, in percent of their goal (or in the unit). */
function ChallengeGraph({ c }: { c: Challenge }) {
  const [as, setAs] = useState<'percent' | 'value'>('percent')
  const since = c.createdAt ?? new Date().toISOString()
  const lines = Object.entries(c.players).map(([uid, p]) => ({ uid, p, points: series(p, as, since) }))
  const xs = lines.flatMap((l) => l.points.map(([x]) => x))
  const ys = lines.flatMap((l) => l.points.map(([, y]) => y))
  const [x0, x1] = [Math.min(...xs), Math.max(...xs, Math.min(...xs) + 86400000)]
  const [y0, y1] = as === 'percent' ? [0, 100] : [Math.min(...ys, ...Object.values(c.players).map((p) => p.goal)), Math.max(...ys, ...Object.values(c.players).map((p) => p.goal))]
  const W = 100
  const H = 50
  const px = (x: number) => ((x - x0) / (x1 - x0)) * W
  const py = (y: number) => H - ((y - y0) / (y1 - y0 || 1)) * H
  const date = (t: number) => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' })
  return (
    <div className="challenge-graph">
      <div className="row">
        <span className="segmented small" role="group" aria-label="Show as">
          <button type="button" className={as === 'percent' ? 'on' : ''} aria-pressed={as === 'percent'} onClick={() => setAs('percent')}>
            % of goal
          </button>
          <button type="button" className={as === 'value' ? 'on' : ''} aria-pressed={as === 'value'} onClick={() => setAs('value')}>
            {c.unit || 'Value'}
          </button>
        </span>
      </div>
      <svg viewBox={`-8 -3 ${W + 12} ${H + 10}`} role="img" aria-label="Progress over time">
        <text x={-1} y={0} className="graph-label" textAnchor="end">
          {as === 'percent' ? '100%' : fmt(y1)}
        </text>
        <text x={-1} y={H} className="graph-label" textAnchor="end">
          {as === 'percent' ? '0%' : fmt(y0)}
        </text>
        <text x={0} y={H + 6} className="graph-label">
          {date(x0)}
        </text>
        <text x={W} y={H + 6} className="graph-label" textAnchor="end">
          {date(x1)}
        </text>
        <path d={`M0 0H${W}M0 ${H}H${W}`} className="graph-grid" />
        {lines.map(({ uid, p, points }) => (
          <g key={uid}>
            <polyline points={points.map(([x, y]) => `${px(x)},${py(y)}`).join(' ')} fill="none" stroke={p.color} strokeWidth={0.8} strokeLinejoin="round" />
            {points.map(([x, y], i) => (
              <circle key={i} cx={px(x)} cy={py(y)} r={1} fill={p.color} />
            ))}
          </g>
        ))}
      </svg>
      <div className="row wrap small">
        {lines.map(({ uid, p }) => (
          <span key={uid} className="challenge-key">
            <span style={{ background: p.color }} /> {p.icon} {p.nickname}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Your part in a challenge: nickname, icon, color, where you start and your goal, and a goal of yours to log too. */
function PlayerForm({ c, player, onDone, accepting = false }: { c: Pick<Challenge, 'id' | 'title' | 'unit' | 'goalIcon' | 'players'>; player?: ChallengePlayer; onDone: (p?: ChallengePlayer) => void; accepting?: boolean }) {
  const app = useApp()
  const { goals } = useData()
  const taken = new Set(Object.entries(c.players ?? {}).filter(([id]) => id !== app.uid).map(([, p]) => p.color))
  const [nickname, setNickname] = useState(player?.nickname ?? app.member.displayName)
  const [icon, setIcon] = useState(player?.icon ?? PLAYER_ICONS[Object.keys(c.players ?? {}).length % PLAYER_ICONS.length])
  const [color, setColor] = useState(player?.color ?? PLAYER_COLORS.find((x) => !taken.has(x)) ?? PLAYER_COLORS[0])
  const [start, setStart] = useState(player ? String(player.start) : '')
  const [goal, setGoal] = useState(player ? String(player.goal) : '')
  // Each check-in can also log a measure goal of yours: one you have (a weight goal is picked for you), or a new one.
  const measures = useMemo(() => goals.filter((g) => g.kind === 'measure' && !g.archived && g.ownerId === app.uid && canLogGoal(g, app.uid, app.member.role)), [goals, app.uid, app.member.role])
  const weighty = (g: Goal) => /weight|lb|kg|pound/i.test(`${g.name} ${g.unit ?? ''}`)
  const [link, setLink] = useState<string>(player ? (player.goalId ?? '') : (measures.find(weighty)?.id ?? (app.isMember && /^(lb|lbs|kg)$/i.test(c.unit) ? 'new' : '')))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    const s = parseValue(start)
    const g = parseValue(goal)
    if (s === null || g === null) return setError('Type where you start and your goal, as numbers.')
    if (s === g) return setError('Your goal needs to differ from where you start.')
    setBusy(true)
    setError(null)
    try {
      let goalId = link && link !== 'new' ? link : undefined
      if (link === 'new') {
        const name = /^(lb|lbs|kg)$/i.test(c.unit) ? 'Weight' : c.title
        goalId = await createGoal({ name, kind: 'measure', unit: c.unit || undefined, target: g, direction: g < s ? 'down' : 'up', visibility: 'family', viewerVisible: true, ownerId: app.uid, editAudience: 'private' }, app.uid)
      }
      const p: ChallengePlayer = { ...(player ?? {}), nickname, icon, color, start: s, goal: g, goalId, joinedAt: player?.joinedAt }
      if (c.id) await savePlayer(c.id, app.uid, p)
      onDone(p)
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <form className="challenge-form card" onSubmit={save}>
      <h4>{accepting ? `Join “${c.title}”` : c.id ? 'My settings' : 'You'}</h4>
      <label className="small">
        Nickname
        <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={40} required />
      </label>
      <div className="grid2">
        <label className="small">
          Starting {c.unit || 'value'}
          <input inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} placeholder="200" required />
        </label>
        <label className="small">
          Goal {c.unit || 'value'}
          <input inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="170" required />
        </label>
      </div>
      <span className="label small">Your icon</span>
      <div className="emoji-choices" role="radiogroup" aria-label="Your icon">
        {PLAYER_ICONS.map((x) => (
          <button key={x} type="button" className={x === icon ? 'on' : ''} onClick={() => setIcon(x)} aria-pressed={x === icon}>
            {x}
          </button>
        ))}
      </div>
      <span className="label small">Your color</span>
      <div className="color-choices" role="radiogroup" aria-label="Your color">
        {PLAYER_COLORS.map((x) => (
          <button key={x} type="button" className={x === color ? 'on' : ''} style={{ background: x }} onClick={() => setColor(x)} aria-pressed={x === color} aria-label={x} title={taken.has(x) ? 'Someone else has this one' : undefined} />
        ))}
      </div>
      {app.isMember && (
        <label className="small">
          Also log each check-in to a goal
          <select value={link} onChange={(e) => setLink(e.target.value)}>
            <option value="">No</option>
            {measures.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.unit ? ` (${g.unit})` : ''}
              </option>
            ))}
            <option value="new">Make a new goal for it{/^(lb|lbs|kg)$/i.test(c.unit) ? ': Weight' : ''}</option>
          </select>
        </label>
      )}
      {error && <p className="error small">{error}</p>}
      <div className="row">
        <button type="submit" className="small" disabled={busy}>
          {busy ? 'Saving…' : accepting ? 'Join' : 'Save'}
        </button>
        <button type="button" className="link small" onClick={() => onDone()}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/** An invitation on Home: join (choosing your nickname, icon, color, start and goal) or no thanks. */
function Invitation({ c }: { c: Challenge }) {
  const app = useApp()
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const from = app.household.members[c.createdBy]?.displayName ?? 'Someone'
  return (
    <article className="challenge-card invitation">
      <SectionHeader icon="trophy" title={c.title} beside={<span className="muted small tile-status">{from} invited you</span>}>
        {!joining && (
          <>
            <button type="button" className="small" onClick={() => setJoining(true)}>
              Accept
            </button>
            <button type="button" className="link small" onClick={() => void leaveChallenge(c, app.uid).catch((err) => setError(errorText(err)))}>
              No thanks
            </button>
          </>
        )}
      </SectionHeader>
      <div className="tile-body">
        <Track c={c} />
        {joining && <PlayerForm c={c} accepting onDone={() => setJoining(false)} />}
        {error && <p className="error small">{error}</p>}
      </div>
    </article>
  )
}

/** Starting a challenge: its title, unit and finish icon, who to invite, and your own part. */
function NewChallenge({ onDone }: { onDone: () => void }) {
  const app = useApp()
  const [title, setTitle] = useState('')
  const [unit, setUnit] = useState('lb')
  const [goalIcon, setGoalIcon] = useState(GOAL_ICONS[0])
  const [invited, setInvited] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const people = Object.entries(app.household.members)
    .filter(([id, m]) => id !== app.uid && !m.bot && (m.role === 'member' || m.role === 'viewer'))
    .sort((a, b) => a[1].displayName.localeCompare(b[1].displayName))
  const draft = { id: '', title: title || 'your challenge', unit, goalIcon, players: {} }

  async function create(me?: ChallengePlayer) {
    if (!me) return onDone()
    if (!title.trim()) return setError('Give it a title first.')
    try {
      await createChallenge(app.uid, { title, unit, goalIcon, invited }, me)
      if (invited.length) await sendToInbox(app.uid, invited, { kind: 'challenge', title: `invited you to a challenge: ${title.trim()}`, text: 'Accept it on Home (or Challenges in the Library) and set your own start and goal.', link: '#/challenges' }).catch(() => undefined)
      onDone()
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <div className="challenge-new card">
      <h3>New challenge</h3>
      <label className="small">
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The Road to 40" maxLength={80} autoFocus />
      </label>
      <label className="small">
        Measured in
        <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="lb, kg, $, miles…" maxLength={12} />
      </label>
      <span className="label small">Finish line</span>
      <div className="emoji-choices" role="radiogroup" aria-label="Finish line icon">
        {GOAL_ICONS.map((x) => (
          <button key={x} type="button" className={x === goalIcon ? 'on' : ''} onClick={() => setGoalIcon(x)} aria-pressed={x === goalIcon}>
            {x}
          </button>
        ))}
      </div>
      <span className="label small">Invite</span>
      <div className="chips">
        {people.map(([id, m]) => (
          <label key={id} className={`chip-toggle${invited.includes(id) ? ' on' : ''}`}>
            <input type="checkbox" checked={invited.includes(id)} onChange={() => setInvited((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]))} />
            {m.displayName}
          </label>
        ))}
      </div>
      {error && <p className="error small">{error}</p>}
      <PlayerForm c={draft} onDone={(p) => void create(p)} />
    </div>
  )
}

/** The creator's settings: title, unit, finish icon, more invitations, end (or reopen), delete. */
function ChallengeSettings({ c, onDone }: { c: Challenge; onDone: () => void }) {
  const app = useApp()
  const [title, setTitle] = useState(c.title)
  const [unit, setUnit] = useState(c.unit)
  const [goalIcon, setGoalIcon] = useState(c.goalIcon)
  const [invited, setInvited] = useState(c.invited)
  const [error, setError] = useState<string | null>(null)
  const people = Object.entries(app.household.members)
    .filter(([id, m]) => id !== app.uid && !m.bot && (m.role === 'member' || m.role === 'viewer'))
    .sort((a, b) => a[1].displayName.localeCompare(b[1].displayName))

  async function save(e: FormEvent) {
    e.preventDefault()
    try {
      const added = invited.filter((x) => !c.invited.includes(x))
      await updateChallenge(c.id, { title: title.trim() || c.title, unit, goalIcon, invited: [...new Set([c.createdBy, ...invited])] })
      if (added.length) await sendToInbox(app.uid, added, { kind: 'challenge', title: `invited you to a challenge: ${title.trim() || c.title}`, link: '#/challenges' }).catch(() => undefined)
      onDone()
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <form className="challenge-form card" onSubmit={save}>
      <h4>Edit challenge</h4>
      <label className="small">
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
      </label>
      <label className="small">
        Measured in
        <input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={12} />
      </label>
      <span className="label small">Finish line</span>
      <div className="emoji-choices" role="radiogroup" aria-label="Finish line icon">
        {GOAL_ICONS.map((x) => (
          <button key={x} type="button" className={x === goalIcon ? 'on' : ''} onClick={() => setGoalIcon(x)} aria-pressed={x === goalIcon}>
            {x}
          </button>
        ))}
      </div>
      <span className="label small">Invited</span>
      <div className="chips">
        {people.map(([id, m]) => (
          <label key={id} className={`chip-toggle${invited.includes(id) ? ' on' : ''}`}>
            <input type="checkbox" checked={invited.includes(id)} disabled={!!c.players[id]} onChange={() => setInvited((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]))} />
            {m.displayName}
            {c.players[id] ? ' (in)' : ''}
          </label>
        ))}
      </div>
      {error && <p className="error small">{error}</p>}
      <div className="row wrap">
        <button type="submit" className="small">
          Save
        </button>
        <button type="button" className="link small" onClick={onDone}>
          Cancel
        </button>
        <span className="grow" />
        <button type="button" className="link small" onClick={() => (c.status === 'active' ? window.confirm(`End “${c.title}”? It stays in Past challenges.`) : true) && void setChallengeStatus(c.id, c.status === 'active' ? 'ended' : 'active').then(onDone, (err) => setError(errorText(err)))}>
          {c.status === 'active' ? 'End the challenge' : 'Start it again'}
        </button>
      </div>
    </form>
  )
}
