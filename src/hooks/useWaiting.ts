import { today } from '../engine/dates'
import { useDailyBoards } from '../firebase/games'
import { wordleDate } from '../games/wordle'
import { dayBuckets } from '../utils/day'
import { loggableGoals, met } from '../utils/goals'
import type { Tile } from '../utils/tiles'
import { useApp, useData } from './useApp'
import { useInbox } from './useInbox'

/**
 * The tiles that can show only when something's waiting there (Home's "When something's new"), and what that
 * means for each.
 */
export const WAITABLE: Record<string, string> = {
  'panel:inbox': 'a message you haven’t read',
  'panel:goals': 'goals left to do today',
  'panel:todo': 'tasks for today',
  'game:wordle': 'today’s Wordle, not played yet',
}

/**
 * Whether a tile has something waiting now (true for tiles that can't tell, so they always show). Only looks up
 * today's Wordle boards when Wordle is one of the tiles that waits.
 */
export function useWaiting(whenNew: Set<Tile>): (t: Tile) => boolean {
  const app = useApp()
  const { tasks, goals } = useData()
  const { unread } = useInbox()
  const day = today()
  const boards = useDailyBoards(whenNew.has('game:wordle') ? wordleDate() : '')
  return (t: Tile) => {
    switch (t) {
      case 'panel:inbox':
        return unread > 0
      case 'panel:goals': {
        const { forDay } = loggableGoals(goals, app.uid, app.member.role, app.household, day)
        return forDay.some((g) => !met(g, g.log?.[day], day))
      }
      case 'panel:todo':
        return dayBuckets(tasks.filter((x) => app.canEdit(x)), day, day).todo.length > 0
      case 'game:wordle':
        return !boards.some((b) => b.uid === app.uid && b.complete)
      default:
        return true
    }
  }
}
