import { readFileSync, readdirSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseCards } from '../../src/utils/flashcards'

it('imports every sample deck completely', async () => {
  const dir = new URL('../../samples/flashcards/', import.meta.url)
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.yaml'))) {
    const text = readFileSync(new URL(f, dir), 'utf8')
    const cards = await parseCards(text)
    expect(cards.length, f).toBe((text.match(/^- front:/gm) ?? []).length)
    expect(cards.every((c) => c.front && c.back), f).toBe(true)
  }
})
