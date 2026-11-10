export type HanoiRod = 'A' | 'B' | 'C'
export type HanoiBoard = Record<HanoiRod, number[]>

export const HANOI_DISKS = 3
export const HANOI_RODS: HanoiRod[] = ['A', 'B', 'C']

export function newHanoiBoard(disks = HANOI_DISKS): HanoiBoard {
  return { A: Array.from({ length: disks }, (_, i) => disks - i), B: [], C: [] }
}

export function moveHanoiDisk(board: HanoiBoard, from: HanoiRod, to: HanoiRod): HanoiBoard | null {
  if (from === to || !board[from].length) return null
  const disk = board[from][board[from].length - 1]
  const destination = board[to][board[to].length - 1]
  if (destination !== undefined && destination < disk) return null
  return {
    ...board,
    [from]: board[from].slice(0, -1),
    [to]: [...board[to], disk],
  }
}

export function hanoiSolved(board: HanoiBoard, disks = HANOI_DISKS): boolean {
  return board.C.length === disks
}
