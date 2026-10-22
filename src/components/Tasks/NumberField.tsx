import { useState, type InputHTMLAttributes } from 'react'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min'> {
  value: number
  /** Smallest allowed value (none: any, including negative). */
  min?: number
  /** Allow decimals (e.g. 0.5 lb); otherwise whole numbers only. */
  decimals?: boolean
  onChange: (value: number) => void
}

/**
 * A number box you can clear and retype (whole numbers, or decimals with `decimals`). Clamping on every keystroke (the old way) put the minimum straight
 * back when the box was emptied, so "0" couldn't be deleted. Here the text is free while typing; each valid number
 * is passed on, and leaving the box empty (or invalid) restores the last valid value. Tapping it selects the number,
 * so typing replaces it.
 */
export function NumberField({ value, min, decimals = false, onChange, onBlur, onFocus, ...rest }: Props) {
  const [text, setText] = useState<string | null>(null) // null: not being edited, show `value`
  return (
    <input
      {...rest}
      type="number"
      inputMode={decimals ? 'decimal' : 'numeric'}
      step={decimals ? 'any' : undefined}
      min={min}
      value={text ?? String(value)}
      onFocus={(e) => {
        e.target.select()
        onFocus?.(e)
      }}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value)
        const ok = e.target.value.trim() !== '' && Number.isFinite(n) && (decimals || Number.isInteger(n)) && (min === undefined || n >= min)
        if (ok) onChange(n)
      }}
      onBlur={(e) => {
        setText(null)
        onBlur?.(e)
      }}
    />
  )
}
