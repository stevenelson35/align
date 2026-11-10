import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as { getIdToken: () => Promise<string> } | null },
}))

vi.mock('./config', () => ({ auth: mocks.auth }))

import { getDailyWordle } from './wordle'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('id-token') }
  vi.stubGlobal('window', { location: { origin: 'https://align.example' } })
})

afterEach(() => vi.unstubAllGlobals())

describe('Wordle API responses', () => {
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
})
