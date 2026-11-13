import { ENTRY_SIZES, type EntrySize } from '../../utils/entries'

/** Simple · Medium · Detail, for a list's header. */
export function EntrySizeSwitch({ value, onChange }: { value: EntrySize; onChange: (size: EntrySize) => void }) {
  return (
    <span className="entry-size-switch" role="group" aria-label="How much each row shows">
      {ENTRY_SIZES.map((s) => (
        <button key={s.value} type="button" className={`link small${value === s.value ? ' on' : ''}`} aria-pressed={value === s.value} onClick={() => onChange(s.value)}>
          {s.label}
        </button>
      ))}
    </span>
  )
}
