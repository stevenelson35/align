// The Daily's chess items: an easy "mate in one" puzzle from Lichess (free, readable by a browser), and a short
// chess lesson that comes with Align. The chess library (to turn the game into a board) loads only when needed.

export interface ChessPuzzle {
  /** The position (FEN). */
  fen: string
  toMove: 'White' | 'Black'
  /** The mating move in chess notation, e.g. "Qe2#". */
  answer: string
  /** The puzzle on Lichess (to try it there). */
  url: string
}

/** An easy mate-in-one from Lichess's puzzle collection (a new one each day per device). */
export async function fetchChessPuzzle(): Promise<ChessPuzzle> {
  const r = await fetch('https://lichess.org/api/puzzle/next?angle=mateIn1&difficulty=easiest', { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`${r.status}`)
  const data = await r.json()
  const { Chess } = await import('chess.js')
  const game = new Chess()
  game.loadPgn(data.game.pgn)
  const fen = game.fen()
  const toMove = game.turn() === 'w' ? 'White' : 'Black'
  const uci: string = data.puzzle.solution[0]
  const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  return { fen, toMove, answer: move.san, url: `https://lichess.org/training/${data.puzzle.id}` }
}

/** The pieces on each square, rank 8 down to rank 1, from a FEN. */
export function boardFromFen(fen: string): (string | null)[][] {
  return fen
    .split(' ')[0]
    .split('/')
    .map((row) => {
      const out: (string | null)[] = []
      for (const ch of row) {
        if (/\d/.test(ch)) out.push(...Array<null>(Number(ch)).fill(null))
        else out.push(ch)
      }
      return out
    })
}

export interface ChessTip {
  title: string
  tip: string
  more: string
}

/** Short lessons, beginner-friendly, one a day. */
export const CHESS_TIPS: ChessTip[] = [
  { title: 'Control the center', tip: 'In the opening, try to put pawns or pieces on (or aimed at) the four center squares: d4, e4, d5, e5.', more: 'Pieces in the center reach more squares and can quickly go to either side of the board.' },
  { title: 'Develop your knights and bishops early', tip: 'Bring out knights and bishops before moving the same piece twice or bringing out the queen.', more: 'Every move in the opening should bring a new piece into play. “Knights before bishops” is a handy rule of thumb.' },
  { title: 'Castle early', tip: 'Castling tucks your king into safety and connects your rooks. Aim to castle in the first ten or so moves.', more: 'An uncastled king in the center is a common target once the position opens up.' },
  { title: 'Don’t bring the queen out too early', tip: 'An early queen can be chased by your opponent’s pieces, who develop while attacking it.', more: 'Every time you move your queen to escape, your opponent gains time.' },
  { title: 'Piece values', tip: 'Pawn 1, knight 3, bishop 3, rook 5, queen 9. Use these to judge trades.', more: 'The king is priceless. Two bishops together are often worth a little more than a bishop and a knight.' },
  { title: 'Check, captures, threats', tip: 'Before every move, look for your checks, captures and threats, then your opponent’s.', more: 'This simple habit catches most tactics and blunders.' },
  { title: 'The fork', tip: 'A fork is one piece attacking two (or more) things at once. Knights are famous forkers.', more: 'A knight fork on the king and queen usually wins the queen.' },
  { title: 'The pin', tip: 'A pin is when a piece can’t move without exposing a more valuable piece behind it.', more: 'If the piece behind is the king, it’s an “absolute pin”: the pinned piece can’t legally move off that line.' },
  { title: 'The skewer', tip: 'A skewer is a pin in reverse: a valuable piece is attacked and, when it moves, the piece behind it is captured.', more: 'Bishops, rooks and queens make skewers along lines and diagonals.' },
  { title: 'Discovered attack', tip: 'Moving one piece out of the way can uncover an attack by another piece behind it.', more: 'If the uncovered attack is a check, it’s a “discovered check”: very powerful, because the moving piece can attack something else too.' },
  { title: 'Back-rank mate', tip: 'A king trapped behind its own pawns on the back row can be checkmated by a rook or queen.', more: 'Giving your king an escape square (a “luft”, like moving the h-pawn one step) prevents it.' },
  { title: 'Don’t leave pieces hanging', tip: 'A “hanging” piece is one that is attacked and not defended. Check every piece after each move.', more: 'Ask: “Is anything of mine attacked and not defended?” before you let go of the piece.' },
  { title: 'Rooks love open files', tip: 'Put rooks on files with no pawns (open files), where they can reach deep into the opponent’s side.', more: 'Two rooks on the same file or rank (“doubled”) are especially strong. A rook on the 7th rank is often powerful.' },
  { title: 'Knights on the rim are dim', tip: 'A knight on the edge of the board covers fewer squares than one in the center.', more: 'A centralized knight can reach 8 squares; in a corner, only 2.' },
  { title: 'Passed pawns must be pushed', tip: 'A passed pawn has no enemy pawns in front of it or on the files next to it. Push it toward promotion.', more: 'In the endgame, a passed pawn can tie down a whole enemy piece to stop it.' },
  { title: 'Activate your king in the endgame', tip: 'Once the queens are off, the king becomes a strong piece. March it toward the center.', more: 'In many endgames, the side with the more active king wins.' },
  { title: 'Checkmate with king and queen', tip: 'Use the queen to box the enemy king toward the edge, then bring your king close to help deliver mate.', more: 'Be careful not to stalemate: always leave the enemy king a legal move until the final check.' },
  { title: 'Stalemate is a draw', tip: 'If the player to move has no legal move and is not in check, the game is a draw (stalemate).', more: 'When you’re far ahead, make sure your opponent always has a move.' },
  { title: 'Think about your opponent’s plan', tip: 'After your opponent moves, ask “Why did they play that? What do they threaten?”', more: 'Many games are lost by ignoring the opponent’s last move.' },
  { title: 'Trade when you’re ahead', tip: 'If you are ahead in material, trading pieces (not pawns) makes your advantage bigger.', more: 'A one-pawn advantage matters much more with few pieces left.' },
  { title: 'Doubled pawns', tip: 'Two of your pawns on the same file are “doubled”. They can’t protect each other and are often weak.', more: 'They aren’t always bad—sometimes they open a file for your rook—but avoid them without a reason.' },
  { title: 'Isolated pawn', tip: 'A pawn with no friendly pawns on the files next to it is “isolated” and must be guarded by pieces.', more: 'The square in front of an isolated pawn is a great outpost for the opponent’s knight.' },
  { title: 'En passant', tip: 'If a pawn moves two squares and lands beside an enemy pawn, that enemy pawn may capture it as if it had moved one square—but only on the very next move.', more: 'It’s the rule that surprises most new players. The capturing pawn ends up on the square the other pawn skipped.' },
  { title: 'Castling rules', tip: 'You can’t castle out of, through, or into check, or if the king or that rook has already moved.', more: 'The squares between the king and rook must also be empty.' },
  { title: 'Promotion', tip: 'A pawn that reaches the far end becomes any piece you choose (except a king). Usually a queen.', more: 'Sometimes a knight is better (“underpromotion”), for example to give a check or avoid stalemate.' },
]
