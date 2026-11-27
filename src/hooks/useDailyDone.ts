import { today } from '../engine/dates'
import { usePlay } from '../firebase/play'
import { doneToday } from '../utils/play'
import { useApp } from './useApp'

/** Which daily games you've finished today (from your play-time record: each daily game counts once a day). */
export function useDailyDone(): Set<string> {
  const app = useApp()
  const play = usePlay(app.uid, app.canPlay)
  return new Set(doneToday(play?.daily, today()))
}
