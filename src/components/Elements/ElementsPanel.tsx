import { useEffect, useState } from 'react'
import { today } from '../../engine/dates'
import { useApp } from '../../hooks/useApp'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { useTodayExpansion } from '../../hooks/useTodaySection'
import { elementOfDay, familyOf, keySentence, loadElements, type Element } from '../../utils/elements'
import { SectionHeader } from '../UI/SectionHeader'
import { PeriodicTable } from './PeriodicTable'
import { GlossaryText } from './Term'

/**
 * The periodic table on Today: an element of the day (the same for everyone) with its family and a line about it,
 * the small colored table with it marked, and Open for the full table to explore.
 */
export function ElementsPanel() {
  const app = useApp()
  const [open, saveOpen] = useStoredFlag('align-today-elements', false)
  const setOpen = useTodayExpansion(open, saveOpen)
  const [elements, setElements] = useState<Element[] | null>(null)
  useEffect(() => {
    if (open && !elements) void loadElements().then(setElements)
  }, [open, elements])
  const e = elements ? elementOfDay(elements, today()) : null
  return (
    <div className="day-section elements-panel">
      <SectionHeader icon="sparkle" title="Periodic Table" onTitleClick={() => setOpen(!open)} expanded={open} help="elements">
        <button type="button" className="link small" onClick={() => app.navigate({ view: 'elements' })}>
          Open
        </button>
        <button type="button" className="link small" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'}
        </button>
      </SectionHeader>
      {open && !e && <p className="muted small">Opening…</p>}
      {open && e && elements && (
        <div className="section-content elements-today">
          <button type="button" className="element-of-day" onClick={() => app.navigate({ view: 'elements', symbol: e.symbol })} title={`More about ${e.name}`}>
            <span className={`element-tile small fam-${e.family}`}>
              <span className="pnum">{e.number}</span>
              <span className="element-sym">{e.symbol}</span>
            </span>
            <span className="grow">
              <span className="muted small">Element of the day</span>
              <strong>{e.name}</strong>
              <span className="muted small">{familyOf(e.family).label}</span>
            </span>
          </button>
          <p className="small">
            <GlossaryText text={keySentence(e)} />
          </p>
          <button type="button" className="ptable-mini-link" onClick={() => app.navigate({ view: 'elements', symbol: e.symbol })} aria-label="Open the periodic table">
            <PeriodicTable elements={elements} picked={e.number} mini />
          </button>
        </div>
      )}
    </div>
  )
}
