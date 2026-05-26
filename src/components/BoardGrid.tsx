import type { Cell, CellMarks, BingoLine, PlayerRole } from '../types';
import BingoCell from './BingoCell';
import styles from './BoardGrid.module.css';

export interface BoardGridProps {
  cells: Cell[];
  marks: CellMarks[];
  bingoLines: BingoLine[];
  myRole: PlayerRole;
  onCellClick: (cellIndex: number) => void;
}

/**
 * BoardGrid renders a 5×5 CSS grid of BingoCell components.
 * Computes which cells are part of bingo lines and passes visual state to each cell.
 */
export default function BoardGrid({
  cells,
  marks,
  bingoLines,
  myRole,
  onCellClick,
}: BoardGridProps) {
  // Compute the set of cell indices that are part of any bingo line
  const bingoIndices = computeBingoIndices(bingoLines);

  return (
    <div className={styles.boardGrid} role="grid" aria-label="Bingo board">
      {cells.map((cell) => {
        const cellMarks = marks[cell.index] ?? {
          hostMarked: false,
          guestMarked: false,
        };
        const isInBingoLine = bingoIndices.has(cell.index);
        const isMarkedByMe =
          myRole === 'host' ? cellMarks.hostMarked : cellMarks.guestMarked;

        return (
          <BingoCell
            key={cell.index}
            cell={cell}
            marks={cellMarks}
            isInBingoLine={isInBingoLine}
            isMarkedByMe={isMarkedByMe}
            onClick={() => onCellClick(cell.index)}
          />
        );
      })}
    </div>
  );
}

/**
 * Given an array of BingoLine descriptors, compute the set of all cell indices
 * that belong to at least one completed bingo line.
 */
function computeBingoIndices(bingoLines: BingoLine[]): Set<number> {
  const indices = new Set<number>();

  for (const line of bingoLines) {
    const lineIndices = getLineIndices(line);
    for (const idx of lineIndices) {
      indices.add(idx);
    }
  }

  return indices;
}

/**
 * Returns the 5 cell indices for a given bingo line.
 */
function getLineIndices(line: BingoLine): number[] {
  switch (line.type) {
    case 'row':
      return [0, 1, 2, 3, 4].map((col) => line.index * 5 + col);
    case 'column':
      return [0, 1, 2, 3, 4].map((row) => row * 5 + line.index);
    case 'diagonal':
      if (line.index === 0) {
        // Top-left to bottom-right
        return [0, 6, 12, 18, 24];
      }
      // Top-right to bottom-left
      return [4, 8, 12, 16, 20];
    default:
      return [];
  }
}
