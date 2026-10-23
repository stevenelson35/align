import { HELP_TOPICS, type HelpTopicId } from '../help/topics'

// Hash routes (/#/...) so Turbify's static hosting needs no rewrite rules (DESIGN.md §4).

export type Route =
  | { view: 'home' }
  | { view: 'mine' }
  | { view: 'family' }
  | { view: 'today' }
  /** Another day's view (today is `today`). */
  | { view: 'day'; day: string }
  | { view: 'work' }
  | { view: 'list'; listId: string; timeline: boolean }
  | { view: 'boards' }
  /** A board; `itemId` opens one item's details (links in texts). */
  | { view: 'board'; boardId: string; itemId?: string }
  | { view: 'goals' }
  /** ✍ New blog post. */
  | { view: 'blog' }
  /** Favorite photos (psort). */
  | { view: 'photos' }
  /** The read-only wall display (a kitchen screen such as an Echo Show). */
  | { view: 'wall' }
  /** Help & about; `topic` scrolls to one section. */
  | { view: 'help'; topic?: HelpTopicId }
  | { view: 'goal'; goalId: string }
  /** A link to one task / item / note (e.g. in a text): opens it in its list. */
  | { view: 'task'; taskId: string }

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  switch (parts[0]) {
    case 'all':
      return { view: 'home' }
    case 'mine':
    case 'family':
    case 'today':
    case 'work':
    case 'boards':
    case 'goals':
    case 'blog':
    case 'photos':
    case 'wall':
      return { view: parts[0] }
    case 'help':
      return HELP_TOPICS.some((t) => t.id === parts[1]) ? { view: 'help', topic: parts[1] as HelpTopicId } : { view: 'help' }
    case 'list':
      if (parts[1]) return { view: 'list', listId: parts[1], timeline: parts[2] === 'timeline' }
      break
    case 'board':
      if (parts[1]) return parts[2] ? { view: 'board', boardId: parts[1], itemId: parts[2] } : { view: 'board', boardId: parts[1] }
      break
    case 'task':
      if (parts[1]) return { view: 'task', taskId: parts[1] }
      break
    case 'goal':
      if (parts[1]) return { view: 'goal', goalId: parts[1] }
      break
    case 'day':
      if (/^\d{4}-\d{2}-\d{2}$/.test(parts[1] ?? '')) return { view: 'day', day: parts[1] }
      break
  }
  // Today is the start page.
  return { view: 'today' }
}

export function routeHash(route: Route): string {
  switch (route.view) {
    case 'home':
      return '#/all'
    case 'list':
      return `#/list/${encodeURIComponent(route.listId)}${route.timeline ? '/timeline' : ''}`
    case 'board':
      return `#/board/${encodeURIComponent(route.boardId)}${route.itemId ? `/${encodeURIComponent(route.itemId)}` : ''}`
    case 'task':
      return `#/task/${encodeURIComponent(route.taskId)}`
    case 'day':
      return `#/day/${route.day}`
    case 'goal':
      return `#/goal/${encodeURIComponent(route.goalId)}`
    case 'help':
      return route.topic ? `#/help/${route.topic}` : '#/help'
    default:
      return `#/${route.view}`
  }
}
