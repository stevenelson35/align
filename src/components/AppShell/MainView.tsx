import { today } from '../../engine/dates'
import { useApp, useData } from '../../hooks/useApp'
import { TimelineView } from '../Dependencies/TimelineView'
import { ChecklistView } from '../Tasks/ChecklistView'
import { CombinedView } from '../Tasks/CombinedView'
import { DayView } from '../Tasks/DayView'
import { BlogPostView } from '../Blog/BlogPostView'
import { GoalDetail } from '../Goals/GoalDetail'
import { GoalsView } from '../Goals/GoalsView'
import { LinksView } from '../Tasks/LinksView'
import { NotesView } from '../Tasks/NotesView'
import { ListView } from '../Tasks/ListView'
import { PhotosView } from '../Photos/PhotosView'
import { BoardsView } from '../Voting/BoardsView'
import { BoardView } from '../Voting/BoardView'

export function MainView() {
  const { route, uid } = useApp()
  const { lists, boards, tasks, listItems, goals, loaded } = useData()

  switch (route.view) {
    case 'home':
      return <CombinedView key="home" title="Everything" tasks={tasks} />
    case 'mine':
      return <CombinedView key="mine" title="My tasks" tasks={tasks.filter((t) => t.visibility === 'private' && t.ownerId === uid)} />
    case 'family':
      return <CombinedView key="family" title="Family tasks" tasks={tasks.filter((t) => t.visibility === 'family')} />
    case 'work':
      return <CombinedView key="work" title="Work" tasks={tasks.filter((t) => t.context === 'work')} />
    case 'today':
      return <DayView key="today" day={today()} />
    case 'day':
      return <DayView key={route.day} day={route.day} />
    case 'task': {
      // A link to one task: its list (AppShell opens the task in the side panel).
      const t = tasks.find((x) => x.id === route.taskId) ?? listItems.find((x) => x.id === route.taskId)
      if (!t) return <p className="muted">{loaded ? "That task isn't shared with you, or it was deleted." : 'Opening…'}</p>
      const list = lists.find((l) => l.id === t.listId)
      if (!list) return <p className="muted">That list isn't shared with you.</p>
      if (list.kind === 'checklist') return <ChecklistView key={list.id} list={list} />
      if (list.kind === 'notes') return <NotesView key={list.id} list={list} />
      if (list.kind === 'links') return <LinksView key={list.id} list={list} />
      return <ListView key={list.id} list={list} />
    }
    case 'list': {
      const list = lists.find((l) => l.id === route.listId)
      if (!list) return <p className="muted">That list doesn't exist or isn't shared with you.</p>
      if (list.kind === 'checklist') return <ChecklistView key={list.id} list={list} />
      if (list.kind === 'notes') return <NotesView key={list.id} list={list} />
      if (list.kind === 'links') return <LinksView key={list.id} list={list} />
      return route.timeline ? <TimelineView list={list} /> : <ListView key={list.id} list={list} />
    }
    case 'goals':
      return <GoalsView />
    case 'blog':
      return <BlogPostView />
    case 'photos':
      return <PhotosView />
    case 'goal': {
      const goal = goals.find((g) => g.id === route.goalId)
      if (!goal) return <p className="muted">{loaded ? "That goal isn't shared with you, or it was deleted." : 'Opening…'}</p>
      return <GoalDetail key={goal.id} goal={goal} />
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
