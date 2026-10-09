import { today } from '../../engine/dates'
import { useApp, useData } from '../../hooks/useApp'
import { isForToday } from '../../utils/tasks'
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
      return <CombinedView key="home" title="Everything" tasks={tasks} />
    case 'mine':
      return <CombinedView key="mine" title="My tasks" tasks={tasks.filter((t) => t.visibility === 'private' && t.ownerId === uid)} />
    case 'family':
      return <CombinedView key="family" title="Family tasks" tasks={tasks.filter((t) => t.visibility === 'family')} />
    case 'work':
      return <CombinedView key="work" title="Work" tasks={tasks.filter((t) => t.context === 'work')} />
    case 'today': {
      const day = today()
      // Done ones are included so "Any status" / "Done" can show them; "Not done" (the default) hides them.
      return <CombinedView key="today" title="Today" tasks={tasks.filter((t) => isForToday(t, day, true))} />
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
