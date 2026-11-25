import type { ReactNode } from 'react'
import { useApp } from '../../hooks/useApp'
import { Icon } from './Icon'

/**
 * The top of every page except Home (Today): where you are on the left (a breadcrumb, when the page has one), and a
 * colored ↩ Home button on the right, so Home is always one tap away (it's the anchor for nearly everything).
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
      <button type="button" className="small home-button" onClick={() => navigate({ view: 'today' })} title="Back to Home (Today)" aria-label="Back to Home">
        <Icon name="back" /> Home
      </button>
    </div>
  )
}
