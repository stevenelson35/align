import { useApp, useData } from '../../hooks/useApp'
import { useTodayItems } from '../../hooks/useTodayItems'
import { mailUrl, telUrl } from '../../utils/contacts'
import { safeUrl } from '../../utils/links'
import { smsUrl } from '../../utils/text'
import { Icon } from '../UI/Icon'

/**
 * The contacts and links you put on Today ("Show on Today" in their details), as one row at the top: a person with
 * call / text / email, a link that opens in a new tab. Tap a person's name for everything about them.
 */
export function TodayShortcuts() {
  const app = useApp()
  const { listItems } = useData()
  const { ids } = useTodayItems()
  const items = ids.map((id) => listItems.find((t) => t.id === id)).filter((t) => !!t)
  if (!items.length) return null
  return (
    <div className="today-shortcuts" role="list" aria-label="On Today">
      {items.map((t) => {
        if (t.contact) {
          const phone = t.contact.phones?.[0]?.value
          const email = t.contact.emails?.[0]?.value
          return (
            <div key={t.id} className="shortcut" role="listitem">
              <button type="button" className="link shortcut-name" onClick={() => app.selectTask(t.id)} title="Details">
                <Icon name="person" /> {t.title}
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
            </div>
          )
        }
        const href = safeUrl(t.url)
        return href ? (
          <a key={t.id} className="shortcut shortcut-link" role="listitem" href={href} target="_blank" rel="noopener noreferrer" title={href}>
            <Icon name="link" /> {t.title} <Icon name="external" />
          </a>
        ) : null
      })}
    </div>
  )
}
