import { useApp } from '../../hooks/useApp'
import type { ElementCardInfo } from '../../utils/elementCards'
import { familyMembers, familyOf, type Element } from '../../utils/elements'
import { Icon } from '../UI/Icon'
import { FamilyStrip, PeriodicTable } from './PeriodicTable'
import { GlossaryText } from './Term'

/**
 * The answer side of an element flashcard, the same picture every time: the small table with the element ringed (or
 * its family lit), the family's row (its own row for the big transition-metal family), what the family has in common
 * (words explained on a tap), and a link into the periodic table.
 */
export function ElementAnswer({ info, elements }: { info: ElementCardInfo; elements: Element[] }) {
  const app = useApp()
  const fam = familyOf(info.family)
  const e = info.element
  const all = familyMembers(elements, info.family)
  // A big family (the transition metals) shows one row: the element's, or (a family card) its first.
  const row = e ? e.y : Math.min(...all.map((x) => x.y))
  const members = all.length > 12 ? all.filter((x) => x.y === row) : all
  return (
    <div className="element-answer">
      <div className="element-answer-table">
        <PeriodicTable elements={elements} picked={e?.number} family={e ? null : info.family} mini />
      </div>
      <p className="element-answer-family">
        <strong>{fam.label}</strong>
        {members.length < all.length && <span className="muted small"> ({e ? `the ones in ${e.name}’s row` : `one row of ${all.length}`})</span>}
      </p>
      <FamilyStrip members={members} picked={e?.number} />
      <ul className="element-traits small">
        {fam.traits.map((t) => (
          <li key={t}>
            <GlossaryText text={t} />
          </li>
        ))}
      </ul>
      <button type="button" className="link small" onClick={() => app.navigate({ view: 'elements', symbol: e?.symbol ?? members[0]?.symbol })}>
        <Icon name="sparkle" /> {e ? `${e.name} in the periodic table` : `${fam.label} in the periodic table`}
      </button>
    </div>
  )
}
