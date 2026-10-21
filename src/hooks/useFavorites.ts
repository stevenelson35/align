import { useEffect, useState } from 'react'
import { loadFavorites, type FavoritesManifest } from '../photos/favorites'

/** psort's published favorites (loaded on first use, then shared for the session). */
export function useFavorites(): { manifest: FavoritesManifest | null; error: string | null } {
  const [manifest, setManifest] = useState<FavoritesManifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    loadFavorites()
      .then((m) => live && setManifest(m))
      .catch((err) => live && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      live = false
    }
  }, [])
  return { manifest, error }
}
