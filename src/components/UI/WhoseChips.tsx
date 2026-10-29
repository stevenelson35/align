import { WHOSE, type Whose } from '../../utils/whose'

/** The All / Mine / Family / Shared chips (plus any extra choices, e.g. Work), the same everywhere. */
export function WhoseChips<T extends string = Whose>({ value, onChange, extra = [], label = 'Whose' }: { value: T; onChange: (w: T) => void; extra?: { value: T; label: string }[]; label?: string }) {
  const choices = [...(WHOSE as { value: T; label: string }[]), ...extra]
  return (
    <div className="chip-filter small whose-chips" role="group" aria-label={label}>
      {choices.map((c) => (
        <button key={c.value} type="button" className={`chip-toggle${value === c.value ? ' on' : ''}`} onClick={() => onChange(c.value)} aria-pressed={value === c.value}>
          {c.label}
        </button>
      ))}
    </div>
  )
}
