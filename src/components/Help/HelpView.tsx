import { useEffect, useRef, useState, type ReactNode } from 'react'
import { HELP_TEXT } from '../../chat/parser'
import { HELP_TOPICS, type HelpTopicId } from '../../help/topics'
import { Icon } from '../UI/Icon'

/** How far below the top of the window a section's heading lands: the sticky top bar plus the topic row. */
function headerOffset(): number {
  const bar = document.querySelector<HTMLElement>('.top-bar')?.offsetHeight ?? 0
  const row = document.querySelector<HTMLElement>('.help-contents')?.offsetHeight ?? 0
  return bar + row + 8
}

/**
 * #/help (and #/help/<topic>): every topic on one page. The topic row stays pinned under the top bar; tapping a
 * topic scrolls to it, and the highlighted topic follows what you're reading. About at the end shows the version.
 */
export function HelpView({ topic }: { topic?: HelpTopicId }) {
  const [active, setActive] = useState<HelpTopicId>(topic ?? HELP_TOPICS[0].id)
  const row = useRef<HTMLElement>(null)
  // While a tap is scrolling the page, the scroll spy waits, so the tapped topic stays highlighted.
  const jumping = useRef(0)

  function go(id: HelpTopicId, smooth = true) {
    const el = document.getElementById(`help-${id}`)
    if (!el) return
    setActive(id)
    jumping.current = Date.now()
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - headerOffset(), behavior: smooth ? 'smooth' : 'auto' })
    // Keep the address shareable without a page change (that would scroll back to the top).
    window.history.replaceState(null, '', `#/help/${id}`)
  }

  // Arriving from a tip ("More in Help"): go straight to its topic.
  useEffect(() => {
    if (topic) requestAnimationFrame(() => go(topic, false))
  }, [topic])

  // Scroll spy: the topic whose heading has passed under the pinned row is the current one.
  useEffect(() => {
    const onScroll = () => {
      if (Date.now() - jumping.current < 800) return
      const line = headerOffset() + 4
      let current = HELP_TOPICS[0].id
      for (const t of HELP_TOPICS) {
        const el = document.getElementById(`help-${t.id}`)
        if (el && el.getBoundingClientRect().top <= line) current = t.id
      }
      // At the very bottom, the last topic (About) is current even if its heading can't reach the line.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = HELP_TOPICS.at(-1)!.id
      setActive(current)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Keep the highlighted topic visible in the (sideways-scrolling) row.
  useEffect(() => {
    const r = row.current
    const chip = r?.querySelector<HTMLElement>(`[data-topic="${active}"]`)
    if (!r || !chip) return
    const left = chip.offsetLeft - r.offsetLeft
    if (left < r.scrollLeft || left + chip.offsetWidth > r.scrollLeft + r.clientWidth) r.scrollTo({ left: left - 16, behavior: 'smooth' })
  }, [active])

  return (
    <section className="help-view">
      <header className="view-header">
        <h2>
          <Icon name="help" /> Help & about
        </h2>
      </header>
      <nav ref={row} className="help-contents" aria-label="Help topics" style={{ top: document.querySelector<HTMLElement>('.top-bar')?.offsetHeight ?? 0 }}>
        {HELP_TOPICS.map((t) => (
          <button key={t.id} type="button" data-topic={t.id} className={`chip-link${t.id === active ? ' on' : ''}`} aria-current={t.id === active ? 'true' : undefined} onClick={() => go(t.id)}>
            {t.title}
          </button>
        ))}
      </nav>
      {HELP_TOPICS.map((t) => (
        <article key={t.id} id={`help-${t.id}`} className="help-topic">
          <h3>{t.title}</h3>
          <Paragraphs lines={t.id === 'chat' ? [...t.body, ...HELP_TEXT.map((x) => `• ${x}`)] : t.body} />
          {t.id === 'about' && (
            <p className="muted small">
              Version {__BUILD_COMMIT__}, built {new Date(__BUILD_TIME__).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}.
            </p>
          )}
        </article>
      ))}
    </section>
  )
}

/** Paragraphs, with runs of "• " lines as a list. */
function Paragraphs({ lines }: { lines: string[] }) {
  const out: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) {
      out.push(
        <ul key={`l${out.length}`}>
          {list.map((l) => (
            <li key={l}>{l.slice(2)}</li>
          ))}
        </ul>,
      )
    }
    list = []
  }
  for (const l of lines) {
    if (l.startsWith('• ')) list.push(l)
    else {
      flush()
      out.push(<p key={`p${out.length}`}>{l}</p>)
    }
  }
  flush()
  return <>{out}</>
}
