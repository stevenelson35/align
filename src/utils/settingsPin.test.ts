import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasSettingsPin, removeSettingsPin, saveSettingsPin, verifySettingsPin } from './settingsPin'

describe('settings PIN', () => {
  let values: Map<string, string>

  beforeEach(() => {
    values = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    })
    vi.stubGlobal('crypto', globalThis.crypto)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('stores a per-account verifier and verifies the PIN', async () => {
    await saveSettingsPin('steve', '0427')

    expect(hasSettingsPin('steve')).toBe(true)
    expect(hasSettingsPin('daughter')).toBe(false)
    expect(await verifySettingsPin('steve', '0427')).toBe(true)
    expect(await verifySettingsPin('steve', '1234')).toBe(false)
    expect(await verifySettingsPin('daughter', '0427')).toBe(false)
  })

  it('requires four digits and can remove a PIN', async () => {
    await expect(saveSettingsPin('steve', '427')).rejects.toThrow('four-digit PIN')
    await saveSettingsPin('steve', '0427')

    removeSettingsPin('steve')

    expect(hasSettingsPin('steve')).toBe(false)
    expect(await verifySettingsPin('steve', '0427')).toBe(false)
  })
})
