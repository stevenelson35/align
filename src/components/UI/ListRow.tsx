import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

/**
 * A list (or anything you open) as one line, the way Home shows its tiles: the icon in its tinted square, the name, a
 * short status, and ›. Rows sit in a `.tile-body` (indented under their heading) or on a page of their own.
 */
export function ListRow({ icon, name, status, onOpen, after }: { icon: IconName; name: ReactNode; status?: ReactNode; onOpen: () => void; /** Beside the row (a 📌). */ after?: ReactNode }) {
  return (
    <div className="list-row">
      <button type="button" className="list-row-main" onClick={onOpen}>
        <span className="section-icon">
          <Icon name={icon} />
        </span>
        <span className="list-row-name">{name}</span>
        {status && <span className="muted small list-row-status">{status}</span>}
        <span className="list-row-chevron" aria-hidden="true">
          <Icon name="chevron-right" />
        </span>
      </button>
      {after}
    </div>
  )
}
