import { useEffect, useState } from 'react'
import { subscribeItemVotes } from '../firebase/db'
import type { Vote } from '../types'
import { tokenBalance, weeksElapsed } from '../voting/tokens'
import { useApp, useData } from './useApp'

/** The signed-in member's spendable tokens (DESIGN.md §7). */
export function useTokenBalance(): number {
  const { household } = useApp()
  const { myVotes, items } = useData()
  const status = new Map(items.map((i) => [`${i.boardId}/${i.id}`, i.status]))
  const weeks = weeksElapsed(household.tokenStartDate.toDate(), new Date())
  return tokenBalance(
    household.weeklyTokens,
    weeks,
    myVotes.map((v) => ({ tokens: v.tokens, itemStatus: status.get(`${v.boardId}/${v.itemId}`) })),
  )
}

/** Everyone's votes on a board's items, keyed by item id. Totals are computed here, never stored. */
export function useBoardVotes(boardId: string, itemIds: string[]): Map<string, Vote[]> {
  const [votes, setVotes] = useState<Record<string, Vote[]>>({})
  const key = [...itemIds].sort().join(',')

  useEffect(() => {
    if (!key) return
    const unsubs = key.split(',').map((itemId) =>
      subscribeItemVotes(
        boardId,
        itemId,
        (v) => setVotes((prev) => ({ ...prev, [itemId]: v })),
        () => {},
      ),
    )
    return () => unsubs.forEach((u) => u())
  }, [boardId, key])

  return new Map(Object.entries(votes).filter(([id]) => itemIds.includes(id)))
}
