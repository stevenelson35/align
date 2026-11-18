import { useState } from 'react'
import { addTaskNow, createList } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import { useCanSpeak } from '../../hooks/useSpeech'
import type { List } from '../../types'
import { parentsOf, privacyFields } from '../../utils/audience'
import { LANGUAGES, phraseCards, type Language } from '../../utils/phrases'
import { Icon } from '../UI/Icon'
import { Hear } from './Hear'

/**
 * Languages (#/languages): a starter set of everyday phrases in French, Mandarin Chinese and Japanese, each with 🔊 to
 * hear it (this device's voices), and a flashcard set per language (both ways round) to learn them, which also earns
 * Glider play time.
 */
export function LanguagesView() {
  return (
    <section className="languages-view">
      <header className="view-header">
        <h2>Languages</h2>
      </header>
      <p className="muted small">
        Everyday phrases to start with. 🔊 uses this device’s own voices; if one is greyed out, add that language’s voice in the phone’s settings (Text-to-speech, or Spoken Content
        on iPhone).
      </p>
      {LANGUAGES.map((l) => (
        <LanguageCard key={l.id} lang={l} />
      ))}
    </section>
  )
}

function LanguageCard({ lang }: { lang: Language }) {
  const app = useApp()
  const { lists, listItems } = useData()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const can = useCanSpeak(lang.speech)
  const set = lists.find((l) => l.kind === 'cards' && l.name === lang.setName)
  const cards = phraseCards(lang)

  async function make() {
    setBusy(true)
    setError(null)
    try {
      let list = set
      if (!list) {
        const fields = { name: lang.setName, kind: 'cards' as const, ownerId: app.uid, defaultContext: 'family' as const, ...privacyFields('everyone', app.uid, [], parentsOf(app.household)) }
        list = { id: await createList(fields), ...fields } as List
      }
      const target = list
      const have = new Set(listItems.filter((t) => t.listId === target.id).map((t) => t.title))
      // Sent together, in order, so "In order" keeps English → the language first.
      await Promise.all(
        cards
          .filter((c) => !have.has(c.front))
          .map((c) => addTaskNow(target, { title: c.front, notes: c.back, priority: 2, status: 'todo', context: 'family', durationDays: 1, dependsOn: [] }, app.uid).written),
      )
      app.navigate({ view: 'list', listId: target.id, timeline: false })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <article className="language-card">
      <header className="row">
        <h3 className="grow">{lang.name}</h3>
        {!can && <span className="muted small">No {lang.name} voice on this device</span>}
      </header>
      <div className="row wrap">
        {set ? (
          <button type="button" className="small" onClick={() => app.navigate({ view: 'list', listId: set.id, timeline: false })}>
            <Icon name="book" /> Study the flashcards
          </button>
        ) : (
          app.isMember && (
            <button type="button" className="small" onClick={() => void make()} disabled={busy}>
              <Icon name="plus" /> {busy ? 'Making the set…' : `Make the flashcard set (${cards.length} cards)`}
            </button>
          )
        )}
        <button type="button" className="link small" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide the phrases' : `See the ${lang.phrases.length} phrases`}
        </button>
      </div>
      {error && <p className="error small">{error}</p>}
      {open && (
        <ul className="phrase-list">
          {lang.phrases.map((p) => (
            <li key={p.english}>
              <span className="grow">
                <strong lang={lang.speech}>{p.text}</strong>
                {p.romanized && <span className="muted"> {p.romanized}</span>}
                <span className="small"> · {p.english}</span>
              </span>
              <Hear phrase={p} lang={lang} label="Hear" />
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
