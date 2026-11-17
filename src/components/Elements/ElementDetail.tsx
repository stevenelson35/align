import type { ReactNode } from 'react'
import { celsius, familyMembers, familyOf, type Element } from '../../utils/elements'
import { Icon } from '../UI/Icon'
import { FamilyStrip } from './PeriodicTable'
import { GlossaryText, Term } from './Term'

const Fact = ({ label, term, children }: { label: string; term?: string; children: ReactNode }) => (
  <div className="element-fact">
    <dt>{term ? <Term word={label} term={term} /> : label}</dt>
    <dd>{children}</dd>
  </div>
)

/**
 * One element: its tile, the key facts (atomic number, mass, group, period, family, state, what it looks like,
 * melting and boiling points, electrons, who discovered it), what its family has in common, the family's row, a
 * short description and a photo from Wikipedia (with its credit), and a link to read more.
 */
export function ElementDetail({ element: e, elements, onPick }: { element: Element; elements: Element[]; onPick: (e: Element) => void }) {
  const fam = familyOf(e.family)
  // A big family (the transition metals) shows just this element's row of it; the small ones show them all.
  const all = familyMembers(elements, e.family)
  const members = all.length > 12 ? all.filter((x) => x.y === e.y) : all
  const prev = elements.find((x) => x.number === e.number - 1)
  const next = elements.find((x) => x.number === e.number + 1)
  return (
    <article className="element-detail">
      <header className="element-head">
        <span className={`element-tile fam-${e.family}`}>
          <span className="pnum">{e.number}</span>
          <span className="element-sym">{e.symbol}</span>
          <span className="element-tile-name">{e.name}</span>
        </span>
        <div className="grow">
          <h3>{e.name}</h3>
          <p className="muted small">
            {fam.label}
            {e.phase ? ` · ${e.phase.toLowerCase()} at room temperature` : ''}
          </p>
        </div>
        <span className="element-steps">
          <button type="button" className="row-action" disabled={!prev} onClick={() => prev && onPick(prev)} aria-label={prev ? `Previous: ${prev.name}` : 'No previous element'} title={prev?.name}>
            ‹
          </button>
          <button type="button" className="row-action" disabled={!next} onClick={() => next && onPick(next)} aria-label={next ? `Next: ${next.name}` : 'No next element'} title={next?.name}>
            ›
          </button>
        </span>
      </header>
      {e.image && (
        <figure className="element-photo">
          <img src={e.image.url} alt={e.image.title ?? e.name} loading="lazy" />
          {e.image.credit && (
            <figcaption className="muted small">
              <details>
                <summary>Photo credit</summary>
                {e.image.title ? `${e.image.title}. ` : ''}
                {e.image.credit}
              </details>
            </figcaption>
          )}
        </figure>
      )}
      <p>
        <GlossaryText text={e.summary} />
      </p>
      <dl className="element-facts">
        <Fact label="Atomic number" term="atomic number">
          {e.number}
        </Fact>
        {e.mass !== undefined && (
          <Fact label="Atomic mass" term="atomic mass">
            {e.mass}
          </Fact>
        )}
        <Fact label="Group" term="group">
          {e.group ?? (e.family === 'lanthanide' ? 'Lanthanides (row below)' : 'Actinides (row below)')}
        </Fact>
        <Fact label="Period" term="period">
          {e.period}
        </Fact>
        {e.appearance && <Fact label="Looks like">{e.appearance}</Fact>}
        {e.melt !== undefined && <Fact label="Melts at">{celsius(e.melt)} °C</Fact>}
        {e.boil !== undefined && <Fact label="Boils at">{celsius(e.boil)} °C</Fact>}
        {e.density !== undefined && <Fact label="Density">{e.density} {e.phase === 'Gas' ? 'g/L' : 'g/cm³'}</Fact>}
        {e.shells && <Fact label="Electrons per shell">{e.shells.join(', ')}</Fact>}
        {e.discoveredBy && <Fact label="Discovered by">{e.discoveredBy}</Fact>}
        {e.namedBy && <Fact label="Named by">{e.namedBy}</Fact>}
      </dl>
      <section className="element-family">
        <h4>
          {fam.label} <span className="muted small">{fam.blurb}</span>
        </h4>
        <FamilyStrip members={members} picked={e.number} onPick={onPick} />
        {members.length < all.length && <p className="muted small">{all.length} in all; these are the ones in {e.name}’s row.</p>}
        <ul className="element-traits">
          {fam.traits.map((t) => (
            <li key={t}>
              <GlossaryText text={t} />
            </li>
          ))}
        </ul>
      </section>
      {e.source && (
        <a className="small" href={e.source} target="_blank" rel="noopener noreferrer">
          Read more about {e.name} on Wikipedia <Icon name="external" />
        </a>
      )}
    </article>
  )
}
