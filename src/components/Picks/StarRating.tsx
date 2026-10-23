/** Five stars: tap one to give that many; tap your current number again to clear it. Read-only when `onChange` is absent. */
export function StarRating({ value, onChange, label }: { value?: number; onChange?: (stars: number | undefined) => void; label: string }) {
  return (
    <span className={`stars${onChange ? '' : ' readonly'}`} role="group" aria-label={`${label}: ${value ? `${value} of 5 stars` : 'not rated'}`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = !!value && n <= value
        const star = (
          <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
            <path className={on ? 'star-on' : 'star-off'} d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" />
          </svg>
        )
        return onChange ? (
          <button
            key={n}
            type="button"
            className="star"
            onClick={() => onChange(n === value ? undefined : n)}
            aria-label={n === value ? `Clear your rating (${n})` : `${n} star${n > 1 ? 's' : ''}`}
          >
            {star}
          </button>
        ) : (
          <span key={n} className="star">
            {star}
          </span>
        )
      })}
    </span>
  )
}
