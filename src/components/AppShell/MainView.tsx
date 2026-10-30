import { lazy, Suspense } from 'react'
import { today } from '../../engine/dates'
import { useApp, useData } from '../../hooks/useApp'
import { TimelineView } from '../Dependencies/TimelineView'
import { ChecklistView } from '../Tasks/ChecklistView'
import { TasksView } from '../Tasks/TasksView'
import { DayView } from '../Tasks/DayView'
import { BlogPostView } from '../Blog/BlogPostView'
import { GoalDetail } from '../Goals/GoalDetail'
import { GoalsView } from '../Goals/GoalsView'
import { LinksView } from '../Tasks/LinksView'
import { PicksView } from '../Picks/PicksView'
import { CardsView } from '../Cards/CardsView'
import { ContactsView } from '../Contacts/ContactsView'
import { GiftsView } from '../Gifts/GiftsView'
import { NotesView } from '../Tasks/NotesView'
import { ListView } from '../Tasks/ListView'
import { PhotosView } from '../Photos/PhotosView'
import { HelpView } from '../Help/HelpView'
import { BoardsView } from '../Voting/BoardsView'
import { BoardView } from '../Voting/BoardView'

// The map library (Leaflet) loads only when the map is opened.
const FamilyMap = lazy(() => import('../Map/FamilyMap'))
const RevealView = lazy(() => import('../Rewards/RevealView'))

export function MainView() {
  const { route } = useApp()
  const { lists, boards, tasks, listItems, goals, loaded } = useData()

  switch (route.view) {
    case 'home':
    case 'mine':
    case 'family':
    case 'work':
      return <TasksView key={route.view} initial={route.view === 'home' ? 'all' : route.view} />
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
      if (list.kind === 'picks') return <PicksView key={list.id} list={list} />
      if (list.kind === 'cards') return <CardsView key={list.id} list={list} />
      if (list.kind === 'contacts') return <ContactsView key={list.id} list={list} />
      if (list.kind === 'gifts') {
        // A secret companion opens as the gift list it belongs to.
        const shown = (list.giftSecret && lists.find((l) => l.id === list.secretOf)) || list
        return <GiftsView key={shown.id} list={shown} />
      }
      return <ListView key={list.id} list={list} />
    }
    case 'list': {
      const list = lists.find((l) => l.id === route.listId)
      if (!list) return <p className="muted">That list doesn't exist or isn't shared with you.</p>
      if (list.kind === 'checklist') return <ChecklistView key={list.id} list={list} />
      if (list.kind === 'notes') return <NotesView key={list.id} list={list} />
      if (list.kind === 'links') return <LinksView key={list.id} list={list} />
      if (list.kind === 'picks') return <PicksView key={list.id} list={list} />
      if (list.kind === 'cards') return <CardsView key={list.id} list={list} />
      if (list.kind === 'contacts') return <ContactsView key={list.id} list={list} />
      if (list.kind === 'gifts') {
        const shown = (list.giftSecret && lists.find((l) => l.id === list.secretOf)) || list
        return <GiftsView key={shown.id} list={shown} />
      }
      return route.timeline ? <TimelineView list={list} /> : <ListView key={list.id} list={list} />
    }
    case 'goals':
      return <GoalsView />
    case 'blog':
      return <BlogPostView />
    case 'photos':
      return <PhotosView />
    case 'wall':
      return null // drawn by AppShell on its own
    case 'map':
      return (
        <Suspense fallback={<p className="muted">Opening the map…</p>}>
          <FamilyMap />
        </Suspense>
      )
    case 'reveal':
      return (
        <Suspense fallback={<p className="muted">Opening the reveal…</p>}>
          <RevealView />
        </Suspense>
      )
    case 'help':
      return <HelpView topic={route.topic} />
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
      return <BoardView key={`${board.id}:${route.itemId ?? ''}`} board={board} openItemId={route.itemId} />
    }
  }
}
