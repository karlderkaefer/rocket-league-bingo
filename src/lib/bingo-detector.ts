/**
 * Pure bingo detection logic.
 * Checks all possible lines on a board and returns completed ones.
 */

/** State of marks on a single cell */
export interface CellMarks {
  hostMarked: boolean;
  guestMarked: boolean;
}

/** Descriptor for a completed bingo line */
export interface BingoLine {
  type: 'row' | 'column' | 'diagonal';
  index: number; // 0-4 for rows/columns, 0-1 for diagonals
}

/** Which player completed a bingo line */
export type BingoWinner = 'host' | 'guest' | 'both';

/** A bingo line with winner attribution */
export interface BingoLineWithWinner extends BingoLine {
  winner: BingoWinner;
}

/**
 * Detects all completed bingo lines on a board.
 *
 * A cell counts as marked if hostMarked OR guestMarked is true.
 * Checks all possible lines based on board size.
 *
 * @param marks - Array of CellMarks in row-major order
 * @param boardSize - Size of the board (default 5)
 * @returns Array of BingoLine objects for each completed line
 */
export function detectBingo(marks: CellMarks[], boardSize: number = 5): BingoLine[] {
  return detectBingoWithWinner(marks, boardSize);
}

/**
 * Detects bingo lines and determines which player completed each line.
 *
 * A player "wins" a line if they have marked ALL cells in that line.
 * If both players have marked all cells, it's "both".
 * If only the combined marks complete the line (neither alone), it's "both" (cooperative).
 *
 * @param marks - Array of CellMarks in row-major order
 * @param boardSize - Size of the board (default 5)
 * @returns Array of BingoLineWithWinner objects
 */
export function detectBingoWithWinner(marks: CellMarks[], boardSize: number = 5): BingoLineWithWinner[] {
  const lines: BingoLineWithWinner[] = [];
  const allLineIndices = getLineIndices(boardSize);

  for (const lineDef of allLineIndices) {
    if (isLineComplete(marks, lineDef.indices)) {
      const winner = determineLineWinner(marks, lineDef.indices);
      lines.push({ type: lineDef.type, index: lineDef.index, winner });
    }
  }

  return lines;
}

/**
 * Get all line definitions for a given board size.
 */
function getLineIndices(boardSize: number): { type: 'row' | 'column' | 'diagonal'; index: number; indices: number[] }[] {
  const lines: { type: 'row' | 'column' | 'diagonal'; index: number; indices: number[] }[] = [];

  // Rows
  for (let i = 0; i < boardSize; i++) {
    const indices = Array.from({ length: boardSize }, (_, j) => i * boardSize + j);
    lines.push({ type: 'row', index: i, indices });
  }

  // Columns
  for (let j = 0; j < boardSize; j++) {
    const indices = Array.from({ length: boardSize }, (_, i) => i * boardSize + j);
    lines.push({ type: 'column', index: j, indices });
  }

  // Diagonal top-left to bottom-right
  lines.push({
    type: 'diagonal',
    index: 0,
    indices: Array.from({ length: boardSize }, (_, i) => i * boardSize + i),
  });

  // Diagonal top-right to bottom-left
  lines.push({
    type: 'diagonal',
    index: 1,
    indices: Array.from({ length: boardSize }, (_, i) => i * boardSize + (boardSize - 1 - i)),
  });

  return lines;
}

/**
 * Determine which player "won" a completed line.
 * 
 * Logic:
 * 1. If a player marked ALL cells in the line solo → they win
 * 2. If neither marked all solo, the player with MORE marks in the line wins
 * 3. If equal marks, it's "both" (cooperative)
 */
function determineLineWinner(marks: CellMarks[], indices: number[]): BingoWinner {
  const hostComplete = indices.every((i) => marks[i]?.hostMarked);
  const guestComplete = indices.every((i) => marks[i]?.guestMarked);

  if (hostComplete && guestComplete) return 'both';
  if (hostComplete) return 'host';
  if (guestComplete) return 'guest';

  // Neither completed it solo — count who has more marks in this line
  let hostCount = 0;
  let guestCount = 0;
  for (const i of indices) {
    if (marks[i]?.hostMarked) hostCount++;
    if (marks[i]?.guestMarked) guestCount++;
  }

  if (hostCount > guestCount) return 'host';
  if (guestCount > hostCount) return 'guest';
  return 'both';
}

/**
 * A line is complete when all cells are marked by at least one player.
 */
function isLineComplete(marks: CellMarks[], indices: number[]): boolean {
  return indices.every((i) => {
    const cell = marks[i];
    return cell !== undefined && (cell.hostMarked || cell.guestMarked);
  });
}
