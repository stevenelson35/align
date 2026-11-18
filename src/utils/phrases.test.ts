import { describe, expect, it } from 'vitest'
import { LANGUAGES, phraseCards, phraseChoices, readPhraseCard } from './phrases'

let seed = 11
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

describe('language phrases', () => {
  it('has 15 phrases per language, each read back from its cards both ways', () => {
    for (const lang of LANGUAGES) {
      expect(lang.phrases).toHaveLength(15)
      const cards = phraseCards(lang)
      expect(cards).toHaveLength(30)
      for (const c of cards) expect(readPhraseCard(c.front)?.lang.id, c.front).toBe(lang.id)
      expect(new Set(cards.map((c) => c.front)).size).toBe(30)
    }
    expect(phraseCards(LANGUAGES[2])[3]).toEqual({ front: 'How do you say “Thank you” in Japanese?', back: 'ありがとうございます (arigatō gozaimasu)' })
    expect(readPhraseCard('What does “Merci” mean?')).toMatchObject({ way: 'from', phrase: { english: 'Thank you' } })
    expect(readPhraseCard('What is the capital of France?')).toBeNull()
  })
  it('offers choices from the same language, the same way round', () => {
    const card = readPhraseCard('How do you say “Hello” in Mandarin Chinese?')!
    const c = phraseChoices(card, '你好 (nǐ hǎo)', rand)
    expect(c).toHaveLength(4)
    expect(c).toContain('你好 (nǐ hǎo)')
    expect(c.every((x) => /[一-鿿]/.test(x))).toBe(true)
    const back = phraseChoices(readPhraseCard('What does “Bonjour” mean?')!, 'Hello', rand)
    expect(back.every((x) => /^[A-Za-z’ ?!.,…]+$/.test(x))).toBe(true)
  })
})
