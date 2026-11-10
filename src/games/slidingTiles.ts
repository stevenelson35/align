export function solvedSlidingTiles(size: number): number[] {
  return [...Array.from({ length: size * size - 1 }, (_, i) => i + 1), 0]
}

export function slidingTileSolved(tiles: number[]): boolean {
  return tiles.every((tile, index) => tile === (index === tiles.length - 1 ? 0 : index + 1))
}

export function slidingTileNeighbors(index: number, size: number): number[] {
  const row = Math.floor(index / size)
  const col = index % size
  return [
    ...(row > 0 ? [index - size] : []),
    ...(row < size - 1 ? [index + size] : []),
    ...(col > 0 ? [index - 1] : []),
    ...(col < size - 1 ? [index + 1] : []),
  ]
}

export function moveSlidingTile(tiles: number[], index: number, size: number): number[] | null {
  const blank = tiles.indexOf(0)
  if (!slidingTileNeighbors(blank, size).includes(index)) return null
  const next = tiles.slice()
  ;[next[blank], next[index]] = [next[index], next[blank]]
  return next
}

/** A repeatable, solvable scramble for one selected photo and board size. */
export function scrambleSlidingTiles(photoId: string, size: number, steps = size * size * 24): number[] {
  let state = 2166136261
  for (const char of `${photoId}:${size}`) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0
  const random = () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822507) + 3266489909) >>> 0
    return state / 0x1_0000_0000
  }
  let tiles = solvedSlidingTiles(size)
  let blank = tiles.length - 1
  let previousBlank = -1
  for (let move = 0; move < steps; move += 1) {
    const options = slidingTileNeighbors(blank, size).filter((index) => index !== previousBlank)
    const next = options[Math.floor(random() * options.length)]
    ;[tiles[blank], tiles[next]] = [tiles[next], tiles[blank]]
    previousBlank = blank
    blank = next
  }
  if (slidingTileSolved(tiles)) {
    const next = slidingTileNeighbors(blank, size)[0]
    ;[tiles[blank], tiles[next]] = [tiles[next], tiles[blank]]
  }
  return tiles
}
