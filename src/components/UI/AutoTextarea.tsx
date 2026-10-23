import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

/**
 * A text box that grows to show what's in it (from `rows` up to most of the screen, then it scrolls), so a long
 * note opened for editing shows most of its text instead of three lines.
 */
export function AutoTextarea({ rows = 3, value, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const max = Math.round(window.innerHeight * 0.6)
    el.style.height = `${Math.min(el.scrollHeight + 2, max)}px`
    el.style.overflowY = el.scrollHeight + 2 > max ? 'auto' : 'hidden'
  }, [value])
  return <textarea ref={ref} rows={rows} value={value} {...rest} />
}
