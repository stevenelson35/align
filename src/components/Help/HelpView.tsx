import { useEffect, type ReactNode } from 'react'
import { HELP_TEXT } from '../../chat/parser'
import { HELP_TOPICS, type HelpTopicId } from '../../help/topics'
import { useApp } from '../../hooks/useApp'
import { Icon } from '../UI/Icon'

/** #/help (and #/help/<topic>): every topic in one page with a contents list; About at the end shows the version. */
export function HelpView({ topic }: { topic?: HelpTopicId }) {
  const { navigate } = useApp()
  useEffect(() => {
    if (topic) document.getElementById(`help-${topic}`)?.scrollIntoView({ block: 'start' })
  }, [topic])
  return (
    <section className="help-view">
      <header className="view-header">
        <h2>
          <Icon name="help" /> Help & about
        </h2>
      </header>
      <nav className="help-contents" aria-label="Help topics">
        {HELP_TOPICS.map((t) => (
          <button key={t.id} type="button" className={`chip-link${t.id === topic ? ' on' : ''}`} onClick={() => navigate({ view: 'help', topic: t.id })}>
            {t.title}
          </button>
        ))}
      </nav>
      {HELP_TOPICS.map((t) => (
        <article key={t.id} id={`help-${t.id}`} className={`help-topic${t.id === topic ? ' current' : ''}`}>
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
