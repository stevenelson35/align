import { useCallback, useEffect, useState } from 'react'
import { parseRoute, routeHash, type Route } from '../utils/routes'

export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))

  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((next: Route) => {
    window.location.hash = routeHash(next)
  }, [])

  return [route, navigate]
}
