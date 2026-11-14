import { DEFAULT_TILE_GAP, setTileGap, TILE_GAPS, useTileGap } from '../../hooks/useTileGap'

/** "Space between tiles": a slider from snug to roomy (this device). In Arrange and in Settings. */
export function TileGapSetting() {
  const gap = useTileGap()
  const at = (TILE_GAPS as readonly number[]).indexOf(gap)
  return (
    <label className="tile-gap-setting small">
      <span>Space between tiles</span>
      <input
        type="range"
        min={0}
        max={TILE_GAPS.length - 1}
        step={1}
        value={at}
        onChange={(e) => setTileGap(TILE_GAPS[Number(e.target.value)])}
        aria-valuetext={`${gap} rem`}
      />
      <span className="muted">{gap === DEFAULT_TILE_GAP ? 'usual' : gap < DEFAULT_TILE_GAP ? 'snug' : 'roomy'}</span>
      {gap !== DEFAULT_TILE_GAP && (
        <button type="button" className="link small" onClick={() => setTileGap(DEFAULT_TILE_GAP)}>
          Reset
        </button>
      )}
    </label>
  )
}
