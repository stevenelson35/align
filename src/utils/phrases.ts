// Phrases in other languages (DESIGN.md §5.18): a small starter set per language, studied as flashcards both ways
// ("How do you say “Thank you” in Japanese?" / "What does “ありがとうございます” mean?"), with the phone's own voices
// to hear them. Cards stay plain text; a card is recognized by its wording. Pure, unit-tested.
import type { Card } from './flashcards'

export type LanguageId = 'fr' | 'zh' | 'ja'

export interface Phrase {
  english: string
  /** As written in the language. */
  text: string
  /** How to read it in Latin letters (pinyin, romaji); none for French. */
  romanized?: string
}

export interface Language {
  id: LanguageId
  name: string
  /** For speech (the browser's voices). */
  speech: string
  setName: string
  phrases: Phrase[]
}

export const LANGUAGES: Language[] = [
  {
    id: 'fr',
    name: 'French',
    speech: 'fr-FR',
    setName: 'French phrases',
    phrases: [
      { english: 'Hello', text: 'Bonjour' },
      { english: 'Goodbye', text: 'Au revoir' },
      { english: 'Please', text: 'S’il vous plaît' },
      { english: 'Thank you', text: 'Merci' },
      { english: 'You’re welcome', text: 'De rien' },
      { english: 'Excuse me', text: 'Excusez-moi' },
      { english: 'How are you?', text: 'Comment allez-vous ?' },
      { english: 'I’m fine, thank you', text: 'Je vais bien, merci' },
      { english: 'My name is…', text: 'Je m’appelle…' },
      { english: 'Nice to meet you', text: 'Enchanté' },
      { english: 'I don’t understand', text: 'Je ne comprends pas' },
      { english: 'Where is the bathroom?', text: 'Où sont les toilettes ?' },
      { english: 'How much is it?', text: 'C’est combien ?' },
      { english: 'Good night', text: 'Bonne nuit' },
      { english: 'Cheers!', text: 'Santé !' },
    ],
  },
  {
    id: 'zh',
    name: 'Mandarin Chinese',
    speech: 'zh-CN',
    setName: 'Mandarin Chinese phrases',
    phrases: [
      { english: 'Hello', text: '你好', romanized: 'nǐ hǎo' },
      { english: 'Goodbye', text: '再见', romanized: 'zàijiàn' },
      { english: 'Please', text: '请', romanized: 'qǐng' },
      { english: 'Thank you', text: '谢谢', romanized: 'xièxie' },
      { english: 'You’re welcome', text: '不客气', romanized: 'bú kèqi' },
      { english: 'Sorry', text: '对不起', romanized: 'duìbuqǐ' },
      { english: 'How are you?', text: '你好吗？', romanized: 'nǐ hǎo ma?' },
      { english: 'I’m fine, thank you', text: '我很好，谢谢', romanized: 'wǒ hěn hǎo, xièxie' },
      { english: 'My name is…', text: '我叫…', romanized: 'wǒ jiào…' },
      { english: 'Nice to meet you', text: '很高兴认识你', romanized: 'hěn gāoxìng rènshi nǐ' },
      { english: 'I don’t understand', text: '我不明白', romanized: 'wǒ bù míngbai' },
      { english: 'Where is the bathroom?', text: '洗手间在哪里？', romanized: 'xǐshǒujiān zài nǎlǐ?' },
      { english: 'How much is it?', text: '多少钱？', romanized: 'duōshao qián?' },
      { english: 'Good night', text: '晚安', romanized: 'wǎn’ān' },
      { english: 'Cheers!', text: '干杯！', romanized: 'gānbēi!' },
    ],
  },
  {
    id: 'ja',
    name: 'Japanese',
    speech: 'ja-JP',
    setName: 'Japanese phrases',
    phrases: [
      { english: 'Hello', text: 'こんにちは', romanized: 'konnichiwa' },
      { english: 'Goodbye', text: 'さようなら', romanized: 'sayōnara' },
      { english: 'Please', text: 'お願いします', romanized: 'onegaishimasu' },
      { english: 'Thank you', text: 'ありがとうございます', romanized: 'arigatō gozaimasu' },
      { english: 'You’re welcome', text: 'どういたしまして', romanized: 'dō itashimashite' },
      { english: 'Excuse me', text: 'すみません', romanized: 'sumimasen' },
      { english: 'How are you?', text: 'お元気ですか？', romanized: 'o-genki desu ka?' },
      { english: 'I’m fine, thank you', text: '元気です、ありがとう', romanized: 'genki desu, arigatō' },
      { english: 'My name is…', text: '私は…です', romanized: 'watashi wa … desu' },
      { english: 'Nice to meet you', text: 'はじめまして', romanized: 'hajimemashite' },
      { english: 'I don’t understand', text: 'わかりません', romanized: 'wakarimasen' },
      { english: 'Where is the bathroom?', text: 'トイレはどこですか？', romanized: 'toire wa doko desu ka?' },
      { english: 'How much is it?', text: 'いくらですか？', romanized: 'ikura desu ka?' },
      { english: 'Good night', text: 'おやすみなさい', romanized: 'oyasuminasai' },
      { english: 'Cheers!', text: '乾杯！', romanized: 'kanpai!' },
    ],
  },
]

export const languageById = (id: LanguageId) => LANGUAGES.find((l) => l.id === id)!

/** How a phrase is written on a card's answer: the text, and how to read it. */
export const phraseAnswer = (p: Phrase) => (p.romanized ? `${p.text} (${p.romanized})` : p.text)

/** A language's set: each phrase both ways, English → the language first. */
export function phraseCards(lang: Language): Card[] {
  return [
    ...lang.phrases.map((p) => ({ front: `How do you say “${p.english}” in ${lang.name}?`, back: phraseAnswer(p) })),
    ...lang.phrases.map((p) => ({ front: `What does “${p.text}” mean?`, back: p.english })),
  ]
}

export interface PhraseCardInfo {
  lang: Language
  phrase: Phrase
  /** to: English → the language (say it); from: the language → English (understand it). */
  way: 'to' | 'from'
}

/** What a phrase card is about, from its words (or null: not one). */
export function readPhraseCard(front: string): PhraseCardInfo | null {
  const to = front.match(/^How do you say “(.+)” in (.+)\?$/)
  if (to) {
    const lang = LANGUAGES.find((l) => l.name === to[2])
    const phrase = lang?.phrases.find((p) => p.english === to[1])
    return lang && phrase ? { lang, phrase, way: 'to' } : null
  }
  const from = front.match(/^What does “(.+)” mean\?$/)
  if (from)
    for (const lang of LANGUAGES) {
      const phrase = lang.phrases.find((p) => p.text === from[1])
      if (phrase) return { lang, phrase, way: 'from' }
    }
  return null
}

/** Wrong answers from the same language and the same way round (three, plus the right one, mixed). */
export function phraseChoices(card: PhraseCardInfo, answer: string, rand: () => number): string[] {
  const others = card.lang.phrases.filter((p) => p !== card.phrase).map((p) => (card.way === 'to' ? phraseAnswer(p) : p.english))
  const wrong = others
    .map((x) => [rand(), x] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, x]) => x)
    .slice(0, 3)
  wrong.splice(Math.floor(rand() * (wrong.length + 1)), 0, answer)
  return wrong
}
