import type { Cell } from '@/lib/board-generator';
import type { CellMarks } from '@/lib/bingo-detector';
import { BingoCell } from './BingoCell';

export interface BoardGridProps {
  cells: Cell[];
  marks: CellMarks[];
  onCellClick?: (cellIndex: number) => void;
  myRole: 'host' | 'guest';
  disabled?: boolean;
  cellErrors?: Set<number>;
  boardSize?: number;
}

/**
 * CSS grid layout of BingoCell components.
 * Supports 3×3, 4×4, and 5×5 board sizes.
 */
export function BoardGrid({ cells, marks, onCellClick, myRole, disabled, cellErrors, boardSize = 5 }: BoardGridProps) {
  const isReadOnly = disabled || !onCellClick;

  const gridColsClass =
    boardSize === 3 ? 'grid-cols-3' :
    boardSize === 4 ? 'grid-cols-4' :
    'grid-cols-5';

  return (
    <div
      role="grid"
      aria-label="Bingo board"
      className={`grid ${gridColsClass} gap-1.5 sm:gap-2 w-full mx-auto`}
    >
      {cells.map((cell, index) => (
        <BingoCell
          key={cell.index}
          cell={cell}
          marks={marks[index] ?? { hostMarked: false, guestMarked: false }}
          onClick={isReadOnly ? undefined : () => onCellClick(index)}
          myRole={myRole}
          disabled={isReadOnly}
          hasError={cellErrors?.has(index)}
        />
      ))}
    </div>
  );
}
