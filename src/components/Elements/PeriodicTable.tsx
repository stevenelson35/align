import type { Element, FamilyId } from '../../utils/elements'

/**
 * The table: 18 columns, the lanthanides and actinides in two rows below. Each cell is colored by family; the picked
 * element is ringed, and a family can be lit while the rest fade. `mini`: small colored squares only (a card or a
 * Today tile).
 */
export function PeriodicTable({
  elements,
  picked,
  family,
  onPick,
  mini = false,
}: {
  elements: Element[]
  picked?: number
  family?: FamilyId | null
  onPick?: (e: Element) => void
  mini?: boolean
}) {
  return (
    <div className={`ptable${mini ? ' mini' : ''}${family ? ' lit' : ''}`} role={mini ? 'img' : 'grid'} aria-label={mini ? 'Periodic table' : 'Periodic table: tap an element'}>
      {elements.map((e) => {
        const style = { gridColumn: e.x, gridRow: e.y }
        const cls = `pcell fam-${e.family}${picked === e.number ? ' picked' : ''}${family && e.family === family ? ' in' : ''}`
        if (mini || !onPick) return <span key={e.number} className={cls} style={style} title={`${e.name} (${e.symbol})`} />
        return (
          <button key={e.number} type="button" className={cls} style={style} onClick={() => onPick(e)} aria-label={`${e.name}, ${e.number}`} aria-pressed={picked === e.number}>
            <span className="pnum">{e.number}</span>
            <span className="psym">{e.symbol}</span>
          </button>
        )
      })}
      {/* Where the lanthanides and actinides belong in the main table. */}
      <span className="pcell pgap fam-lanthanide" style={{ gridColumn: 3, gridRow: 6 }} aria-hidden="true" />
      <span className="pcell pgap fam-actinide" style={{ gridColumn: 3, gridRow: 7 }} aria-hidden="true" />
    </div>
  )
}

/** A family in a row: its members' numbers and symbols, the picked one ringed. */
export function FamilyStrip({ members, picked, onPick }: { members: Element[]; picked?: number; onPick?: (e: Element) => void }) {
  return (
    <div className="family-strip">
      {members.map((e) =>
        onPick ? (
          <button key={e.number} type="button" className={`pcell fam-${e.family}${picked === e.number ? ' picked' : ''}`} onClick={() => onPick(e)} aria-label={e.name}>
            <span className="pnum">{e.number}</span>
            <span className="psym">{e.symbol}</span>
          </button>
        ) : (
          <span key={e.number} className={`pcell fam-${e.family}${picked === e.number ? ' picked' : ''}`} title={e.name}>
            <span className="pnum">{e.number}</span>
            <span className="psym">{e.symbol}</span>
          </span>
        ),
      )}
    </div>
  )
}
