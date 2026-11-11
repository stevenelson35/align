import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as { getIdToken: () => Promise<string> } | null },
}))

vi.mock('./config', () => ({ auth: mocks.auth }))

import { abandonDailyWordle, abandonWordleChallenge, createWordleChallenge, declineWordleChallenge, getDailyWordle, getDailyWordlePreview } from './wordle'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('id-token') }
  vi.stubGlobal('window', { location: { origin: 'https://align.example' } })
})

afterEach(() => vi.unstubAllGlobals())

describe('Wordle API responses', () => {
  it('fetches the daily puzzle date without starting a game', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ date: '2026-11-11', seed: 'daily-2026-11-11' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(getDailyWordlePreview()).resolves.toEqual({
      date: '2026-11-11',
      seed: 'daily-2026-11-11',
    })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: 'daily_preview' })
  })

  it('surfaces JSON errors even when the host returns HTTP 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Wordle is not configured on this server yet.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ))

    await expect(getDailyWordle()).rejects.toThrow('Wordle is not configured on this server yet.')
  })

  it('returns a successful game state', async () => {
    const state = {
      mode: 'daily',
      seed: 'daily-2026-11-10',
      date: '2026-11-10',
      length: 5,
      guesses: [],
      startedAt: '2026-11-10T12:00:00Z',
      elapsedMs: 1,
      complete: false,
      solved: false,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(state), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ))

    await expect(getDailyWordle()).resolves.toEqual(state)
  })

  it('sends an authenticated decline action for a Wordle invitation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ challengeStatus: 'declined' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(declineWordleChallenge('challenge-id')).resolves.toEqual({ challengeStatus: 'declined' })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      action: 'challenge_decline',
      challengeId: 'challenge-id',
    })
  })

  it('sends the selected Wordle challenge type with its players', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ invited: 2, participants: 2 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(createWordleChallenge('APPLE', ['wife', 'daughter'], 'live-chosen')).resolves.toEqual({
      invited: 2,
      participants: 2,
    })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      action: 'custom_create',
      word: 'APPLE',
      recipients: ['wife', 'daughter'],
      challengeType: 'live-chosen',
    })
  })

  it('sends an authenticated give-up action for the daily Wordle', async () => {
    const state = {
      mode: 'daily',
      seed: 'daily-2026-11-10',
      date: '2026-11-10',
      length: 5,
      guesses: [],
      startedAt: '2026-11-10T12:00:00Z',
      elapsedMs: 1000,
      complete: true,
      solved: false,
      abandoned: true,
      answer: 'APPLE',
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(state), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(abandonDailyWordle()).resolves.toEqual(state)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: 'daily_abandon' })
  })

  it('sends an authenticated give-up action for an active Wordle challenge', async () => {
    const state = {
      mode: 'custom',
      seed: 'custom-group',
      length: 5,
      guesses: [],
      startedAt: '2026-11-10T12:00:00Z',
      elapsedMs: 1000,
      complete: true,
      solved: false,
      answer: 'APPLE',
      challengeStatus: 'abandoned',
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(state), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(abandonWordleChallenge('challenge-id')).resolves.toEqual(state)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      action: 'challenge_abandon',
      challengeId: 'challenge-id',
    })
  })
})
