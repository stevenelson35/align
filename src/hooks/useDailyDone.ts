import { today } from '../engine/dates'
import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../firebase/config'
import { usePlay } from '../firebase/play'
import type { DailyBoard } from '../games/wordle'
import { dailyGamesDone } from '../utils/play'
import { useApp } from './useApp'

/** Which daily games you've finished today (from your play-time record: each daily game counts once a day). */
export function useDailyDone(): Set<string> {
  const app = useApp()
  const play = usePlay(app.uid, app.canPlay)
  const day = today()
  const [board, setBoard] = useState<DailyBoard | undefined>()
  useEffect(() => {
    if (!app.canPlay) return
    return onSnapshot(doc(db, 'wordleDailyBoards', `${day}_${app.uid}`),
      (snapshot) => setBoard(snapshot.exists() ? snapshot.data() as DailyBoard : undefined),
      (error) => console.error('Unable to load daily Wordle completion:', error))
  }, [app.uid, app.canPlay, day])
  return dailyGamesDone(play?.daily, day, board, app.uid)
}
