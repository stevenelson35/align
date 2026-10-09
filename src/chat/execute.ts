// Runs parsed chat commands against the household's data (DESIGN.md §9). Replies can carry quick-action buttons.
import type { AppState } from '../context/AppContext'
import type { DataState } from '../context/DataContext'
import { formatDay, today } from '../engine/dates'
import { meetDate, recalculate, shiftForward } from '../engine/scheduling'
import { createList, createTask, setVote, updateTask } from '../firebase/db'
import type { Board, BoardItem, List, Task } from '../types'
import { fuzzyMatch } from '../utils/fuzzy'
import { isFinished, isForToday, people, PRIVACY_ICON } from '../utils/tasks'
import { HELP_TEXT, parse, type Command } from './parser'

export interface Reply {
  text: string
  lines?: string[]
  actions?: { label: string; run: () => Promise<Reply | void> | Reply | void }[]
}

export interface ExecContext {
  app: AppState
  data: DataState
  balance: number
}

/** Fuzzy-resolve a name; on ambiguity, reply with one button per candidate. */
function pick<T>(query: string, items: T[], nameOf: (t: T) => string, noun: string, then: (item: T) => Promise<Reply> | Reply): Promise<Reply> | Reply {
  const m = fuzzyMatch(query, items, nameOf)
  if (m.kind === 'none') return { text: `I couldn't find a ${noun} matching "${query}".` }
  if (m.kind === 'one') return then(m.item)
  return {
    text: `Which ${noun} did you mean?`,
    actions: m.items.map((item) => ({ label: nameOf(item), run: () => then(item) })),
  }
}

const errorText = (err: unknown) => `That didn't work: ${err instanceof Error ? err.message : String(err)}`

function canEditId(ctx: ExecContext) {
  const byId = new Map(ctx.data.tasks.map((t) => [t.id, t]))
  return (id: string) => {
    const t = byId.get(id)
    return !!t && ctx.app.canEdit(t)
  }
}

function describeTask(t: Task, lists: List[]) {
  const list = lists.find((l) => l.id === t.listId)
  const when = t.startDate ? ` · ${formatDay(t.startDate)}` : t.targetDate ? ` · due ${formatDay(t.targetDate)}` : ''
  return `${t.title}${list ? ` (${list.name})` : ''}${when}`
}

const FAMILY_INBOX = 'Family Inbox'

async function addTask(cmd: Extract<Command, { type: 'add' }>, ctx: ExecContext, chosen?: List): Promise<Reply> {
  const { app, data } = ctx
  const editable = data.lists.filter((l) => app.canEdit(l))
  let title = cmd.title
  let list = chosen
  if (!list && cmd.listName) {
    const m = fuzzyMatch(cmd.listName, editable, (l) => l.name)
    if (m.kind === 'one') list = m.item
    else if (m.kind === 'many')
      return {
        text: `Which list should "${title}" go in?`,
        actions: m.items.map((l) => ({ label: l.name, run: () => addTask(cmd, ctx, l) })),
      }
    // No such list: "to ..." was probably part of the title ("take dog to vet").
    else if (cmd.titleWithoutList) title = cmd.titleWithoutList
  }
  // No list named: your inbox for your default privacy (Settings). Private: your own "Inbox" (or first private
  // task list). Family: the shared "Family Inbox".
  const family = (app.member.defaultVisibility ?? 'private') === 'family'
  if (!list) {
    list = family
      ? editable.find((l) => l.visibility === 'family' && l.kind === 'list' && l.name === FAMILY_INBOX)
      : editable.find((l) => l.visibility === 'private' && l.ownerId === app.uid && l.kind === 'list')
  }
  try {
    if (!list) {
      const inbox: Omit<List, 'id'> = family
        ? { name: FAMILY_INBOX, kind: 'list', visibility: 'family', ownerId: app.uid, viewerVisible: false, defaultContext: 'family' }
        : { name: 'Inbox', kind: 'list', visibility: 'private', ownerId: app.uid, viewerVisible: false, defaultContext: 'family' }
      list = { ...inbox, id: await createList(inbox) }
    }
    const names = [
      ...people(app.household).map(([id, m]) => ({ id, name: m.displayName })),
      ...app.household.pets.map((p) => ({ id: p.id, name: p.name })),
    ]
    const forIds: string[] = []
    const unknown: string[] = []
    for (const n of cmd.forNames ?? []) {
      const m = fuzzyMatch(n, names, (x) => x.name, 0.7)
      if (m.kind === 'one') forIds.push(m.item.id)
      else unknown.push(n)
    }
    if (cmd.forText && forIds.length === 0) {
      // Nobody by that name: "for ..." was part of the title ("create plan for laundry room door repair").
      title = `${title} for ${cmd.forText}`
      unknown.length = 0
    }
    const target = list
    const id = await createTask(
      target,
      {
        title,
        priority: cmd.priority ?? 2,
        status: 'todo',
        context: cmd.context ?? target.defaultContext,
        for: forIds.length ? forIds : undefined,
        startDate: cmd.startDate,
        targetDate: cmd.targetDate,
        durationDays: 1,
        dependsOn: [],
      },
      app.uid,
    )
    return {
      text: `Added "${title}" to ${target.name} (${PRIVACY_ICON[target.visibility]} ${target.visibility === 'private' ? 'private' : 'family'})${cmd.startDate ? ` on ${formatDay(cmd.startDate)}` : ''}.`,
      lines: unknown.length ? [`I didn't recognize: ${unknown.join(', ')}.`] : undefined,
      actions: [
        { label: 'Open it', run: () => app.selectTask(id) },
        { label: `Go to ${target.name}`, run: () => app.navigate({ view: 'list', listId: target.id, timeline: false }) },
      ],
    }
  } catch (err) {
    return { text: errorText(err) }
  }
}

function showTasks(title: string, tasks: Task[], ctx: ExecContext): Reply {
  return {
    text: tasks.length ? `${title}: ${tasks.length}` : `${title}: nothing.`,
    lines: tasks.slice(0, 10).map((t) => describeTask(t, ctx.data.lists)),
  }
}

function boardReply(board: Board, ctx: ExecContext): Reply {
  ctx.app.navigate({ view: 'board', boardId: board.id })
  const open = ctx.data.items.filter((i) => i.boardId === board.id && i.status === 'open')
  return { text: `Showing ${board.name} (${open.length} open).` }
}

export async function execute(input: string, ctx: ExecContext): Promise<Reply> {
  const cmd = parse(input)
  const { app, data } = ctx
  const open = data.tasks.filter((t) => !isFinished(t))
  const needsMember = !['help', 'show', 'showBoard', 'showNamed', 'error'].includes(cmd.type)
  if (needsMember && !app.isMember) return { text: 'Viewers can look but not change things.' }

  switch (cmd.type) {
    case 'help':
      return { text: 'Try one of these:', lines: HELP_TEXT }
    case 'error':
      return { text: cmd.message }
    case 'add':
      return addTask(cmd, ctx)
    case 'done':
      return pick(cmd.task, open.filter(app.canEdit), (t) => t.title, 'task', async (t) => {
        try {
          await updateTask(t.id, { status: 'done' })
          return { text: `Marked "${t.title}" done.`, actions: [{ label: 'Undo', run: async () => void (await updateTask(t.id, { status: 'todo' })) }] }
        } catch (err) {
          return { text: errorText(err) }
        }
      })
    case 'cancel':
      return pick(cmd.task, open.filter(app.canEdit), (t) => t.title, 'task', async (t) => {
        const before = t.status
        try {
          await updateTask(t.id, { status: 'canceled' })
          return { text: `Canceled "${t.title}".`, actions: [{ label: 'Undo', run: async () => void (await updateTask(t.id, { status: before })) }] }
        } catch (err) {
          return { text: errorText(err) }
        }
      })
    case 'move':
      return pick(cmd.task, open.filter(app.canEdit), (t) => t.title, 'task', (t) => {
        const preview = shiftForward(data.tasks, { id: t.id, startDate: cmd.date }, canEditId(ctx))
        app.proposeShift({ title: `Move ${t.title} to ${formatDay(cmd.date)}`, preview })
        return { text: `Previewing the move of "${t.title}" to ${formatDay(cmd.date)} (${preview.moves.length} change(s)).` }
      })
    case 'meet':
      return pick(cmd.task, open, (t) => t.title, 'task', (t) => {
        const preview = meetDate(data.tasks, t.id, cmd.date, canEditId(ctx))
        app.proposeShift({ title: `Finish ${t.title} by ${formatDay(cmd.date)}`, preview })
        return { text: `Previewing how to finish "${t.title}" by ${formatDay(cmd.date)} (${preview.moves.length} change(s)).` }
      })
    case 'recalculate':
      return pick(cmd.list, data.lists, (l) => l.name, 'list', (l) => {
        const can = canEditId(ctx)
        const preview = recalculate(data.tasks, (id) => can(id) && data.tasks.find((t) => t.id === id)?.listId === l.id)
        app.navigate({ view: 'list', listId: l.id, timeline: l.kind === 'project' })
        app.proposeShift({ title: `Recalculate ${l.name}`, preview })
        return { text: `Recalculated ${l.name}: ${preview.moves.length} task(s) need to move.` }
      })
    case 'show':
      if (cmd.what === 'work') {
        app.navigate({ view: 'work' })
        return showTasks('Open work tasks', open.filter((t) => t.context === 'work'), ctx)
      } else {
        app.navigate({ view: 'today' })
        const day = today()
        return showTasks('Today', open.filter((t) => isForToday(t, day)), ctx)
      }
    case 'showBoard':
      return pick(cmd.board, data.boards, (b) => b.name, 'board', (b) => boardReply(b, ctx))
    case 'showNamed': {
      type Named = { kind: 'list'; list: List } | { kind: 'board'; board: Board }
      const named: Named[] = [...data.lists.map((list) => ({ kind: 'list' as const, list })), ...data.boards.map((board) => ({ kind: 'board' as const, board }))]
      return pick(cmd.name, named, (n) => (n.kind === 'list' ? n.list.name : n.board.name), 'list or board', (n) => {
        if (n.kind === 'board') return boardReply(n.board, ctx)
        app.navigate({ view: 'list', listId: n.list.id, timeline: false })
        return showTasks(n.list.name, open.filter((t) => t.listId === n.list.id), ctx)
      })
    }
    case 'vote': {
      const boards = cmd.board ? data.boards.filter((b) => fuzzyMatch(cmd.board!, [b], (x) => x.name).kind === 'one') : data.boards
      if (cmd.board && boards.length === 0) return { text: `I couldn't find a board matching "${cmd.board}".` }
      const items = data.items.filter((i) => i.status === 'open' && boards.some((b) => b.id === i.boardId))
      const boardName = (i: BoardItem) => data.boards.find((b) => b.id === i.boardId)?.name ?? ''
      return pick(cmd.item, items, (i) => i.title, 'item', async (item) => {
        if (cmd.tokens > ctx.balance) return { text: `You only have ${ctx.balance} token(s) to spend.` }
        try {
          // Adds to any tokens already on the item.
          const current = ctx.data.myVotes.find((v) => v.itemId === item.id && v.boardId === item.boardId)?.tokens ?? 0
          await setVote(item.boardId, item.id, app.uid, current + cmd.tokens)
          return {
            text: `Put ${cmd.tokens} token(s) on "${item.title}" in ${boardName(item)} (${current + cmd.tokens} total from you).`,
            actions: [{ label: 'Show board', run: () => void app.navigate({ view: 'board', boardId: item.boardId }) }],
          }
        } catch (err) {
          return { text: errorText(err) }
        }
      })
    }
  }
}
