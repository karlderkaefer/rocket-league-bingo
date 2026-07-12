import { useMemo } from 'react';
import { detectBingoWithWinner, type CellMarks, type BingoLineWithWinner } from '@/lib/bingo-detector';

export interface UseBingoReturn {
  bingoLines: BingoLineWithWinner[];
  hasBingo: boolean;
}

/**
 * Hook that runs bingo detection whenever marks change.
 *
 * Returns the current set of completed bingo lines (with winner attribution)
 * and a convenience boolean indicating whether any bingo exists.
 *
 * @param marks - CellMarks array (row-major order)
 * @param boardSize - Board size (default 5)
 */
export function useBingo(marks: CellMarks[], boardSize: number = 5): UseBingoReturn {
  const bingoLines = useMemo(() => detectBingoWithWinner(marks, boardSize), [marks, boardSize]);
  const hasBingo = bingoLines.length > 0;

  return { bingoLines, hasBingo };
}
