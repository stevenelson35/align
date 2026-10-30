import { useState, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

/**
 * Something to look at first and an answer (or more) to reveal after thinking: The Daily's items and flashcards.
 * `open` / `onOpen` make it controlled (a flashcard waits for the answer before "Got it"). With `tapAnywhere`, the
 * reveal button stretches over the whole card (still one button, for keyboards and screen readers).
 */
export function RevealCard({
  label,
  icon,
  front,
  back,
  revealLabel = 'Show answer',
  open,
  onOpen,
  className = '',
  footer,
  tapAnywhere = false,
}: {
  label?: ReactNode
  icon?: IconName
  front: ReactNode
  back?: ReactNode
  revealLabel?: string
  open?: boolean
  onOpen?: () => void
  className?: string
  footer?: ReactNode
  /** The whole card shows the answer when tapped (flashcards), not just the small link. */
  tapAnywhere?: boolean
}) {
  const [shown, setShown] = useState(false)
  const isOpen = open ?? shown
  return (
    <div className={`reveal-card ${isOpen ? 'revealed' : ''}${tapAnywhere && !isOpen ? ' tap-anywhere' : ''} ${className}`}>
      {label && (
        <div className="reveal-label">
          {icon && <Icon name={icon} />} {label}
        </div>
      )}
      <div className="reveal-front">{front}</div>
      {back !== undefined && back !== null && back !== '' && (
        <>
          {isOpen ? (
            <div className="reveal-back">{back}</div>
          ) : (
            <button
              type="button"
              className="link small reveal-button"
              onClick={() => {
                setShown(true)
                onOpen?.()
              }}
            >
              {revealLabel}
            </button>
          )}
        </>
      )}
      {footer}
    </div>
  )
}
