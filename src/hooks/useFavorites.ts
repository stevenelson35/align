import { useEffect, useState } from 'react'
import { loadFavorites, refreshFavoritesIfStale, type FavoritesManifest } from '../photos/favorites'

/** psort's published favorites (loaded on first use and shared; fetched again when you come back after an hour). */
export function useFavorites(): { manifest: FavoritesManifest | null; error: string | null } {
  const [manifest, setManifest] = useState<FavoritesManifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    loadFavorites()
      .then((m) => live && setManifest(m))
      .catch((err) => live && setError(err instanceof Error ? err.message : String(err)))
    // An installed app can stay open for days: on coming back after a while, pick up a newer publish.
    const onShow = () => {
      if (document.visibilityState !== 'visible') return
      // The first to notice fetches it again; the others get the same new list (an unchanged one changes nothing).
      ;(refreshFavoritesIfStale() ?? loadFavorites())
        .then((m) => live && setManifest(m))
        .catch(() => {}) // keep showing the last list
    }
    document.addEventListener('visibilitychange', onShow)
    return () => {
      live = false
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [])
  return { manifest, error }
}
