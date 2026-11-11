import { Timestamp } from 'firebase/firestore'
import { describe, expect, it } from 'vitest'
import type { GameChallenge, WordleChallengeProgress } from '../../firebase/games'
import type { WordleGameState } from '../../firebase/wordle'
import { challengeNotification } from './wordleNotification'

const game: WordleGameState = {
  mode: 'custom',
  seed: 'puzzle',
  length: 5,
  guesses: [],
  startedAt: '2026-11-11T00:00:00Z',
  elapsedMs: 0,
  complete: false,
  solved: false,
}

const challenge: GameChallenge = {
  id: 'challenge',
  gameId: 'wordle',
  from: 'alex',
  to: 'blair',
  players: ['alex', 'blair'],
  status: 'playing',
  challengeType: 'random-live',
}

const members = {
  alex: { displayName: 'Alex' },
  blair: { displayName: 'Blair' },
}

function player(uid: string, updatedAt: WordleChallengeProgress['updatedAt']): WordleChallengeProgress {
  return {
    id: uid,
    groupId: 'puzzle',
    uid,
    participants: ['alex', 'blair'],
    length: 5,
    rows: ['CCCCC'],
    complete: true,
    solved: true,
    updatedAt,
  }
}

describe('Wordle challenge notifications', () => {
  it.each(['random-live', 'realtime-live'] as const)(
    'handles two finished Firestore progress updates before the %s guess response',
    (challengeType) => {
      const progress = [
        player('blair', Timestamp.fromMillis(2000)),
        player('alex', Timestamp.fromMillis(1000)),
      ]
      const liveChallenge = { ...challenge, challengeType }

      expect(challengeNotification(game, liveChallenge, progress, members))
        .toBe('Blair solved (2 finished)! Keep playing or give up.')
      expect(challengeNotification({ ...game, complete: true, solved: true }, liveChallenge, progress, members))
        .toBe('You solved it! Challenge complete.')
      expect(progress.map((item) => item.uid)).toEqual(['blair', 'alex'])
    },
  )

  it('orders mixed Firestore timestamps, dates and legacy strings chronologically', () => {
    const progress = [
      player('alex', new Date('2026-11-11T00:00:01Z')),
      player('blair', Timestamp.fromDate(new Date('2026-11-11T00:00:03Z'))),
      player('unknown', '2026-11-11T00:00:02Z'),
      player('missing', undefined),
    ]
    expect(challengeNotification(game, challenge, progress, members))
      .toBe('Blair solved (4 finished)! Keep playing or give up.')
  })

  it('preserves notifications for one finished player and other outcomes', () => {
    const finished = player('alex', Timestamp.fromMillis(1000))
    expect(challengeNotification(game, challenge, [finished], members))
      .toBe('Alex solved first! Keep playing or give up.')
    expect(challengeNotification(game, challenge, [{ ...finished, solved: false, status: 'abandoned' }], members))
      .toBe('Alex gave up. You can keep playing or give up.')
    expect(challengeNotification({ ...game, complete: true, solved: true }, challenge, [finished], members))
      .toBe('You solved it! Other players can keep going.')
  })
})
