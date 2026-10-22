import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../hooks/useApp'
import { helpTopic, type HelpTopicId } from '../../help/topics'
import { Icon } from './Icon'

/**
 * A small ⓘ beside a heading: tap for a sentence or two about it, and "More in Help" for the topic on the Help page.
 * Tap again, tap elsewhere, or Esc to close. The words come from help/topics.ts (the same text as the Help page).
 */
const BOX_WIDTH = 288

function place(button: HTMLElement) {
  const r = button.getBoundingClientRect()
  const w = Math.min(BOX_WIDTH, window.innerWidth - 16)
  const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8)
  return { left, top: r.bottom + 6 }
}

export function HelpTip({ topic, label }: { topic: HelpTopicId; label?: string }) {
  const { navigate } = useApp()
  // Where the box goes: under the ⓘ, kept on screen (fixed, so a scrolling panel or a narrow phone can't cut it off).
  const [open, setOpen] = useState<{ left: number; top: number } | null>(null)
  const box = useRef<HTMLSpanElement>(null)
  const t = helpTopic(topic)
  useEffect(() => {
    if (!open) return
    const away = (e: Event) => box.current && !box.current.contains(e.target as Node) && setOpen(null)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    const close = () => setOpen(null)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])
  return (
    <span className="help-tip" ref={box}>
      <button type="button" className="help-tip-button" onClick={(e) => setOpen(open ? null : place(e.currentTarget))} aria-expanded={!!open} aria-label={`About ${label ?? t.title}`} title={`About ${label ?? t.title}`}>
        <Icon name="help" />
      </button>
      {open && (
        <span className="help-tip-box" role="dialog" aria-label={t.title} style={{ left: open.left, top: open.top }}>
          <span className="help-tip-text">{t.tip}</span>
          <button
            type="button"
            className="link small"
            onClick={() => {
              setOpen(null)
              navigate({ view: 'help', topic })
            }}
          >
            More in Help →
          </button>
        </span>
      )}
    </span>
  )
}
