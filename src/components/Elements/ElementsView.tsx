import { useEffect, useState } from 'react'
import { useApp } from '../../hooks/useApp'
import { FAMILIES, loadElements, type Element, type FamilyId } from '../../utils/elements'
import { ElementDecks } from './ElementDecks'
import { ElementDetail } from './ElementDetail'
import { PeriodicTable } from './PeriodicTable'

/**
 * The periodic table to explore (#/elements, #/elements/Cu): tap an element for its facts, family and a photo; tap a
 * family to light it up; find one by name, symbol or number. Data: Periodic-Table-JSON (CC BY-SA 3.0, from Wikipedia).
 */
export function ElementsView({ symbol }: { symbol?: string }) {
  const app = useApp()
  const [elements, setElements] = useState<Element[] | null>(null)
  const [family, setFamily] = useState<FamilyId | null>(null)
  const [find, setFind] = useState('')
  useEffect(() => {
    void loadElements().then(setElements)
  }, [])
  // Picking an element brings its details into view (the table stays where it was).
  useEffect(() => {
    if (symbol) requestAnimationFrame(() => document.querySelector('.element-detail')?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  }, [symbol, elements])
  if (!elements) return <p className="muted">Opening the periodic table…</p>
  const picked = elements.find((e) => e.symbol === symbol)
  const pick = (e: Element) => app.navigate({ view: 'elements', symbol: e.symbol })
  const q = find.trim().toLowerCase()
  const found = q ? elements.filter((e) => e.name.toLowerCase().startsWith(q) || e.symbol.toLowerCase() === q || String(e.number) === q).slice(0, 8) : []
  return (
    <section className="elements-view">
      <header className="view-header">
        <h2>Periodic Table</h2>
      </header>
      <div className="row wrap elements-find">
        <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find an element: name, symbol or number" aria-label="Find an element" />
      </div>
      {found.length > 0 && (
        <div className="row wrap elements-found">
          {found.map((e) => (
            <button key={e.number} type="button" className="secondary small" onClick={() => (pick(e), setFind(''))}>
              {e.symbol} · {e.name}
            </button>
          ))}
        </div>
      )}
      <div className="family-legend" role="group" aria-label="Light up a family">
        {FAMILIES.map((f) => (
          <button key={f.id} type="button" className={`family-chip fam-${f.id}${family === f.id ? ' on' : ''}`} onClick={() => setFamily(family === f.id ? null : f.id)} aria-pressed={family === f.id}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="ptable-scroll">
        <PeriodicTable elements={elements} picked={picked?.number} family={family} onPick={pick} />
      </div>
      {picked ? <ElementDetail element={picked} elements={elements} onPick={pick} /> : <p className="muted small">Tap an element to see its facts, its family and a photo.</p>}
      <ElementDecks elements={elements} />
      <p className="muted small">Element facts and photos from Wikipedia via Periodic-Table-JSON (CC BY-SA 3.0); each photo’s credit is under it.</p>
    </section>
  )
}
