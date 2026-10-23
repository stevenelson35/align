import { boardFromFen } from '../../daily/chess'

/** Filled chess glyphs for both sides (white pieces are colored light), so they look alike at small sizes. */
const GLYPH: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
const NAMES: Record<string, string> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' }
const FILES = 'abcdefgh'

/** A chess position from a FEN, drawn from the side to move. Read-only. */
export function ChessBoard({ fen, from = 'White' }: { fen: string; from?: 'White' | 'Black' }) {
  const rows = boardFromFen(fen)
  const ranks = from === 'White' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]
  const files = from === 'White' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]
  return (
    <div className="chess-board" role="img" aria-label={`Chess position, ${from} to move`}>
      {ranks.map((r) =>
        files.map((f) => {
          const piece = rows[r][f]
          const dark = (r + f) % 2 === 1
          const square = `${FILES[f]}${8 - r}`
          return (
            <span key={square} className={`sq ${dark ? 'dark' : 'light'}`} title={piece ? `${piece === piece.toUpperCase() ? 'White' : 'Black'} ${NAMES[piece.toLowerCase()]} on ${square}` : square}>
              {piece && <span className={`pc ${piece === piece.toUpperCase() ? 'w' : 'b'}`}>{GLYPH[piece.toLowerCase()]}</span>}
              {f === files[0] && <span className="coord rank">{8 - r}</span>}
              {r === ranks[7] && <span className="coord file">{FILES[f]}</span>}
            </span>
          )
        }),
      )}
    </div>
  )
}
