import type { ReactNode } from 'react'
import { useApp } from '../../hooks/useApp'
import { Icon } from './Icon'

/**
 * The top of every page except Today: where you are on the left (a breadcrumb, when the page has one), and a button
 * back to Today on the right, so Today is always one tap away (it's the anchor for nearly everything).
 */
export function PageBar({ crumbs }: { crumbs?: ReactNode }) {
  const { navigate } = useApp()
  return (
    <div className="page-bar">
      {crumbs ? (
        <nav className="breadcrumb small" aria-label="Where you are">
          {crumbs}
        </nav>
      ) : (
        <span />
      )}
      <button type="button" className="link small today-button" onClick={() => navigate({ view: 'today' })} title="Back to Today" aria-label="Back to Today">
        <Icon name="calendar" /> Today <Icon name="close" />
      </button>
    </div>
  )
}
