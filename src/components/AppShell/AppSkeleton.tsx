import { useEffect, useState } from 'react'

/** After this long since the page opened, the loading screen says it's still working and offers Reload. */
const SLOW_MS = 15_000

/**
 * Placeholder blocks while Align starts or its first data loads (same look as the outline in index.html, whose
 * inline styles it reuses), so the screen is never blank. `bar` adds the top bar for before the real one exists.
 */
export function AppSkeleton({ bar = false, note = 'Loading…' }: { bar?: boolean; note?: string }) {
  // Taking a long time since the page opened: say it's still working, and offer Reload.
  const [slow, setSlow] = useState(() => performance.now() > SLOW_MS)
  useEffect(() => {
    if (slow) return
    const t = setTimeout(() => setSlow(true), Math.max(0, SLOW_MS - performance.now()))
    return () => clearTimeout(t)
  }, [slow])
  const blocks = (
    <div className="boot-body" aria-busy="true">
      <div className="boot-block short" />
      <div className="boot-block" />
      <div className="boot-block" />
      <div className="boot-block" />
      <span className="boot-note" role="status">
        {note}
        {slow && (
          <>
            {' '}
            Still working (a slow connection can take a minute).{' '}
            <button type="button" onClick={() => window.location.reload()}>
              Reload
            </button>
          </>
        )}
      </span>
    </div>
  )
  if (!bar) return blocks
  return (
    <div className="boot">
      <div className="boot-bar">
        <span className="boot-logo">A</span>
        <span className="boot-name">Align</span>
      </div>
      {blocks}
    </div>
  )
}
