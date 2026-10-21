/**
 * Placeholder blocks while Align starts or its first data loads (same look as the outline in index.html, whose
 * inline styles it reuses), so the screen is never blank. `bar` adds the top bar for before the real one exists.
 */
export function AppSkeleton({ bar = false, note = 'Loading…' }: { bar?: boolean; note?: string }) {
  const blocks = (
    <div className="boot-body" aria-busy="true">
      <div className="boot-block short" />
      <div className="boot-block" />
      <div className="boot-block" />
      <div className="boot-block" />
      <span className="boot-note">{note}</span>
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
