import { useState } from 'react'
import { useApp, useData } from '../../hooks/useApp'
import { useTodayItems } from '../../hooks/useTodayItems'
import { mailUrl, telUrl } from '../../utils/contacts'
import { safeUrl } from '../../utils/links'
import { smsUrl } from '../../utils/text'
import { Icon } from '../UI/Icon'

/**
 * Your Shortcuts (Today's footer): the people and links you added ("Add to Shortcuts" in their details), all alike:
 * a person with call / text / email (tap the name for everything), a link that opens in a new tab. Reorder swaps
 * the call / open buttons for ↑ ↓ (and ✕ to remove), saved in your order on every device.
 */
export function TodayShortcuts() {
  const app = useApp()
  const { listItems } = useData()
  const shortcuts = useTodayItems()
  const [reorder, setReorder] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const items = shortcuts.ids.map((id) => listItems.find((t) => t.id === id)).filter((t) => !!t)
  const fail = (err: unknown) => setError(err instanceof Error ? err.message : String(err))
  if (!items.length)
    return <p className="muted small">Nothing here yet. Open a person (Contacts) or a link (Links) and tap “Add to Shortcuts” to keep them one tap away.</p>
  return (
    <>
    <ul className="shortcut-list">
      {items.map((t, i) => {
        const href = safeUrl(t.url)
        if (reorder)
          return (
            <li key={t.id} className="shortcut">
              <span className="shortcut-main">
                <Icon name={t.contact || !href ? 'person' : 'link'} /> <span className="grow">{t.title}</span>
              </span>
              <button type="button" className="row-action" disabled={i === 0} onClick={() => shortcuts.swap(t.id, items[i - 1].id).catch(fail)} aria-label={`Move ${t.title} up`} title="Move up">
                ↑
              </button>
              <button type="button" className="row-action" disabled={i === items.length - 1} onClick={() => shortcuts.swap(t.id, items[i + 1].id).catch(fail)} aria-label={`Move ${t.title} down`} title="Move down">
                ↓
              </button>
              <button type="button" className="row-action" onClick={() => shortcuts.toggle(t.id).catch(fail)} aria-label={`Remove ${t.title} from Shortcuts`} title="Remove from Shortcuts">
                <Icon name="close" />
              </button>
            </li>
          )
        if (t.contact || !href) {
          const phone = t.contact?.phones?.[0]?.value
          const email = t.contact?.emails?.[0]?.value
          return (
            <li key={t.id} className="shortcut">
              <button type="button" className="shortcut-main" onClick={() => app.selectTask(t.id)} title="Details">
                <Icon name="person" /> <span className="grow">{t.title}</span>
              </button>
              {phone && (
                <>
                  <a className="row-action" href={telUrl(phone)} aria-label={`Call ${t.title}`} title={`Call ${phone}`}>
                    <Icon name="phone" />
                  </a>
                  <a className="row-action" href={smsUrl(phone, '')} aria-label={`Text ${t.title}`} title={`Text ${phone}`}>
                    <Icon name="message" />
                  </a>
                </>
              )}
              {email && (
                <a className="row-action" href={mailUrl(email)} aria-label={`Email ${t.title}`} title={`Email ${email}`}>
                  <Icon name="mail" />
                </a>
              )}
            </li>
          )
        }
        return (
          <li key={t.id} className="shortcut">
            <a className="shortcut-main" href={href} target="_blank" rel="noopener noreferrer" title={href}>
              <Icon name="link" /> <span className="grow">{t.title}</span> <Icon name="external" />
            </a>
            <button type="button" className="row-action" onClick={() => app.selectTask(t.id)} aria-label={`Details for ${t.title}`} title="Details">
              <Icon name="help" />
            </button>
          </li>
        )
      })}
    </ul>
    {items.length > 1 || reorder ? (
      <button type="button" className="link small" onClick={() => setReorder(!reorder)}>
        {reorder ? 'Done' : 'Reorder…'}
      </button>
    ) : null}
    {error && <p className="error small">{error}</p>}
    </>
  )
}
