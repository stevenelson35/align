import { useEffect, useRef, useState } from 'react'
import { GLOSSARY, glossaryParts } from '../../utils/elements'

/** A word that may need explaining: dotted underline; tap it for a short definition (tap again or elsewhere to close). */
export function Term({ word, term }: { word: string; term: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])
  return (
    <span className="term" ref={ref}>
      <button type="button" className="term-word" onClick={() => setOpen(!open)} aria-expanded={open} title="What does this mean?">
        {word}
      </button>
      {open && (
        <span className="term-pop" role="note">
          <strong>{term}</strong>: {GLOSSARY[term]}
        </span>
      )}
    </span>
  )
}

/** Text with its glossary words tappable. */
export function GlossaryText({ text }: { text: string }) {
  return (
    <>
      {glossaryParts(text).map((p, i) => (p.term ? <Term key={i} word={p.text} term={p.term} /> : <span key={i}>{p.text}</span>))}
    </>
  )
}
