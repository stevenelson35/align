import { today } from '../../engine/dates'
import { useApp, useData } from '../../hooks/useApp'
import { TimelineView } from '../Dependencies/TimelineView'
import { CombinedView } from '../Tasks/CombinedView'
import { ListView } from '../Tasks/ListView'
import { BoardsView } from '../Voting/BoardsView'
import { BoardView } from '../Voting/BoardView'

export function MainView() {
  const { route, uid } = useApp()
  const { lists, boards, tasks } = useData()

  switch (route.view) {
    case 'home':
      return <CombinedView title="Everything" tasks={tasks} />
    case 'mine':
      return <CombinedView title="My tasks" tasks={tasks.filter((t) => t.visibility === 'private' && t.ownerId === uid)} />
    case 'family':
      return <CombinedView title="Family tasks" tasks={tasks.filter((t) => t.visibility === 'family')} />
    case 'work':
      return <CombinedView title="Work" tasks={tasks.filter((t) => t.context === 'work')} />
    case 'today': {
      const day = today()
      // Due or scheduled today, overdue, or in progress.
      const todays = tasks.filter(
        (t) =>
          t.status !== 'done' &&
          (t.status === 'doing' || (t.startDate !== undefined && t.startDate <= day) || (t.targetDate !== undefined && t.targetDate <= day)),
      )
      return <CombinedView title="Today" tasks={todays} defaultSort="priority" />
    }
    case 'list': {
      const list = lists.find((l) => l.id === route.listId)
      if (!list) return <p className="muted">That list doesn't exist or isn't shared with you.</p>
      return route.timeline ? <TimelineView list={list} /> : <ListView list={list} />
    }
    case 'boards':
      return <BoardsView />
    case 'board': {
      const board = boards.find((b) => b.id === route.boardId)
      if (!board) return <p className="muted">That board doesn't exist or isn't shared with you.</p>
      return <BoardView board={board} />
    }
  }
}
