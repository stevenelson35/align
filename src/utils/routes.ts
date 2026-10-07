// Hash routes (/#/...) so Turbify's static hosting needs no rewrite rules (DESIGN.md §4).

export type Route =
  | { view: 'home' }
  | { view: 'mine' }
  | { view: 'family' }
  | { view: 'today' }
  | { view: 'work' }
  | { view: 'list'; listId: string; timeline: boolean }
  | { view: 'boards' }
  | { view: 'board'; boardId: string }

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
      return { view: parts[0] }
    case 'list':
      if (parts[1]) return { view: 'list', listId: parts[1], timeline: parts[2] === 'timeline' }
      break
    case 'board':
      if (parts[1]) return { view: 'board', boardId: parts[1] }
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
      return `#/board/${encodeURIComponent(route.boardId)}`
    default:
      return `#/${route.view}`
  }
}
