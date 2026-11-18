import { speak, useCanSpeak } from '../../hooks/useSpeech'
import type { Language, Phrase } from '../../utils/phrases'

/** 🔊: hear a phrase in its language (this device's voice); greyed when the device has none for it. */
export function Hear({ phrase, lang, label = 'Hear it' }: { phrase: Phrase; lang: Language; label?: string }) {
  const can = useCanSpeak(lang.speech)
  return (
    <button
      type="button"
      className="secondary small hear"
      onClick={(e) => {
        e.stopPropagation() // a flashcard's tap-anywhere shouldn't also turn the card
        speak(phrase.text, lang.speech)
      }}
      disabled={!can}
      title={can ? `Hear “${phrase.text}”` : `This device has no ${lang.name} voice (add one in its language settings)`}
      aria-label={`${label}: ${phrase.text}`}
    >
      🔊 {label}
    </button>
  )
}

/** A phrase card's answer: the phrase as written, how to read it, 🔊, and what it means. */
export function PhraseAnswer({ phrase, lang }: { phrase: Phrase; lang: Language }) {
  return (
    <div className="phrase-answer">
      <span className="phrase-text" lang={lang.speech}>
        {phrase.text}
      </span>
      {phrase.romanized && <span className="phrase-romanized">{phrase.romanized}</span>}
      <Hear phrase={phrase} lang={lang} />
      <span className="muted small">
        {lang.name}: “{phrase.english}”
      </span>
    </div>
  )
}
