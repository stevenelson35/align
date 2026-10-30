import { today } from '../engine/dates'
import { startReveal, useLadder, useReveal, useSparks } from '../firebase/rewards'
import { loadFavorites } from '../photos/favorites'
import { iceLeft, activeEarners, thicknessFor } from '../utils/reveal'
import { familySparks, ladderStatus, movesLeft, pickRevealPhoto } from '../utils/sparks'
import { useApp } from './useApp'

/** Goal rewards for the signed-in member: the reveal, everyone's sparks, the ladder, and your moves. */
export function useRewards() {
  const { uid, isMember } = useApp()
  const reveal = useReveal(isMember)
  const sparks = useSparks(isMember)
  const ladder = useLadder(isMember)
  const total = familySparks(sparks)
  const cells = reveal ? reveal.cols * reveal.rows : 0
  const left = reveal ? iceLeft(reveal.hits, reveal.thick, cells) : []
  const cleared = new Set(left.flatMap((n, i) => (n === 0 ? [i] : [])))
  return {
    reveal,
    sparks,
    ladder,
    total,
    status: ladderStatus(ladder, total),
    moves: reveal ? movesLeft(sparks[uid], reveal.startedAt, reveal.spent?.[uid]) : 0,
    left,
    cleared,
    done: !!reveal && cleared.size >= cells,
    pct: cells ? Math.round((cleared.size / cells) * 100) : 0,
    /** A new reveal with a family photo picked by chance (one not revealed before). */
    startNext: async () => {
      const m = await loadFavorites()
      const id = pickRevealPhoto(m.photos, [...(reveal?.past ?? []), ...(reveal ? [reveal.photoId] : [])], Math.random)
      if (!id) throw new Error('No family photos to use yet.')
      await startReveal(uid, id, today(), thicknessFor(activeEarners(sparks, today())), reveal)
    },
  }
}
