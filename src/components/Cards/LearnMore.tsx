import { useState } from 'react'
import { wikiTitle, type GeoIndex, type Place } from '../../utils/geo'
import { Icon } from '../UI/Icon'

interface Summary {
  text: string
  url: string
}

const cache = new Map<string, Promise<Summary | null>>()

/** Wikipedia's free summary of an article (no key): its first sentences and a link. Null if there isn't one. */
function summary(title: string): Promise<Summary | null> {
  if (!cache.has(title))
    cache.set(
      title,
      fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { type?: string; extract?: string; content_urls?: { desktop?: { page?: string }; mobile?: { page?: string } } } | null) =>
          j && j.type !== 'disambiguation' && j.extract ? { text: j.extract, url: j.content_urls?.mobile?.page ?? j.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}` } : null,
        )
        .catch(() => {
          cache.delete(title) // try again next time
          return null
        }),
    )
  return cache.get(title)!
}

/** "Learn more" on a flashcard's answer: a few sentences about the place from Wikipedia, and a link to read on. */
export function LearnMore({ place, index }: { place: Place; index: GeoIndex }) {
  const [state, setState] = useState<'closed' | 'loading' | 'none' | Summary>('closed')
  const title = wikiTitle(place, index.meta)
  if (state === 'closed')
    return (
      <button
        type="button"
        className="link small learn-more"
        onClick={() => {
          setState('loading')
          void summary(title).then((s) => setState(s ?? 'none'))
        }}
      >
        <Icon name="book" /> Learn more about {place.name}
      </button>
    )
  if (state === 'loading') return <p className="muted small">Looking it up…</p>
  if (state === 'none')
    return (
      <a className="small" href={`https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`} target="_blank" rel="noopener noreferrer">
        {place.name} on Wikipedia <Icon name="external" />
      </a>
    )
  // The first two sentences are plenty on a card; the link has the rest.
  const short = state.text.match(/^(.+?[.!?])\s+(.+?[.!?])(\s|$)/)?.slice(1, 3).join(' ') ?? state.text
  return (
    <div className="learn-more-text small">
      <p>{short}</p>
      <a href={state.url} target="_blank" rel="noopener noreferrer">
        Read more on Wikipedia <Icon name="external" />
      </a>
    </div>
  )
}
