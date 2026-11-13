import { useState } from 'react'
import { useApp } from '../../hooks/useApp'
import { Icon } from '../UI/Icon'
import { MenuContents } from './Sidebar'

/**
 * The Library (☰ on a phone): everything in Align as a page (pages, every list by kind, voting boards, settings),
 * with a find box. On a wide screen the same menu sits beside the page.
 */
export function LibraryView() {
  const app = useApp()
  const [filter, setFilter] = useState('')
  return (
    <section className="library">
      <header className="view-header">
        <h2>Library</h2>
        <span className="grow" />
        {app.isMember && (
          <button type="button" className="secondary small" onClick={() => app.editList(null)}>
            <Icon name="plus" /> New list
          </button>
        )}
      </header>
      <input type="search" className="library-find" placeholder="Find a list, page or board…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Find in the Library" />
      <nav className="library-menu">
        <MenuContents onSettings={app.openSettings} filter={filter} />
      </nav>
      {filter.trim() && <p className="muted small">Looking for an entry inside a list? Use search (top bar).</p>}
    </section>
  )
}
