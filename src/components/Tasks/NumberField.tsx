import { useState, type InputHTMLAttributes } from 'react'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min'> {
  value: number
  min: number
  onChange: (value: number) => void
}

/**
 * A whole-number box you can clear and retype. Clamping on every keystroke (the old way) put the minimum straight
 * back when the box was emptied, so "0" couldn't be deleted. Here the text is free while typing; each valid number
 * is passed on, and leaving the box empty (or invalid) restores the last valid value. Tapping it selects the number,
 * so typing replaces it.
 */
export function NumberField({ value, min, onChange, onBlur, onFocus, ...rest }: Props) {
  const [text, setText] = useState<string | null>(null) // null: not being edited, show `value`
  return (
    <input
      {...rest}
      type="number"
      inputMode="numeric"
      min={min}
      value={text ?? String(value)}
      onFocus={(e) => {
        e.target.select()
        onFocus?.(e)
      }}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value.trim() !== '' && Number.isInteger(n) && n >= min) onChange(n)
      }}
      onBlur={(e) => {
        setText(null)
        onBlur?.(e)
      }}
    />
  )
}
