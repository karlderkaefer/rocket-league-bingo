import type { CellMarks, BingoLine } from '../types';

/**
 * Checks all rows, columns, and diagonals for completed bingo lines.
 * A cell counts as marked if either player (host or guest) has marked it.
 * Returns all detected bingo lines.
 */
export function detectBingo(marks: CellMarks[]): BingoLine[] {
  const lines: BingoLine[] = [];

  // Check 5 rows: row i has indices [i*5, i*5+1, i*5+2, i*5+3, i*5+4]
  for (let i = 0; i < 5; i++) {
    const rowIndices = [i * 5, i * 5 + 1, i * 5 + 2, i * 5 + 3, i * 5 + 4];
    if (isLineComplete(marks, rowIndices)) {
      lines.push({ type: 'row', index: i });
    }
  }

  // Check 5 columns: column j has indices [j, j+5, j+10, j+15, j+20]
  for (let j = 0; j < 5; j++) {
    const colIndices = [j, j + 5, j + 10, j + 15, j + 20];
    if (isLineComplete(marks, colIndices)) {
      lines.push({ type: 'column', index: j });
    }
  }

  // Check diagonal 0 (top-left to bottom-right): indices [0, 6, 12, 18, 24]
  const diag0 = [0, 6, 12, 18, 24];
  if (isLineComplete(marks, diag0)) {
    lines.push({ type: 'diagonal', index: 0 });
  }

  // Check diagonal 1 (top-right to bottom-left): indices [4, 8, 12, 16, 20]
  const diag1 = [4, 8, 12, 16, 20];
  if (isLineComplete(marks, diag1)) {
    lines.push({ type: 'diagonal', index: 1 });
  }

  return lines;
}

/**
 * A line is complete when all 5 cells are marked by at least one player.
 */
function isLineComplete(marks: CellMarks[], indices: number[]): boolean {
  return indices.every(i => {
    const cell = marks[i];
    return cell !== undefined && (cell.hostMarked || cell.guestMarked);
  });
}
