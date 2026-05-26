import type { Cell, CellMarks } from '../types';
import styles from './BoardGrid.module.css';

export interface BingoCellProps {
  cell: Cell;
  marks: CellMarks;
  isInBingoLine: boolean;
  isMarkedByMe: boolean;
  onClick: () => void;
}

/**
 * BingoCell renders an individual cell on the bingo board.
 * Visual states:
 * - unmarked: no marks from either player
 * - marked-host: host marked only
 * - marked-guest: guest marked only
 * - marked-both: both players marked
 * - bingo-line: cell is part of a completed bingo line
 */
export default function BingoCell({
  cell,
  marks,
  isInBingoLine,
  isMarkedByMe,
  onClick,
}: BingoCellProps) {
  const stateClass = getStateClass(marks);
  const isMarked = marks.hostMarked || marks.guestMarked;

  const classNames = [
    styles.bingoCell,
    stateClass,
    isInBingoLine ? styles.bingoCellBingoLine : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classNames}
      onClick={onClick}
      aria-label={`${cell.text}${isMarked ? ', marked' : ''}`}
      aria-pressed={isMarkedByMe}
      type="button"
    >
      {cell.text}
    </button>
  );
}

function getStateClass(marks: CellMarks): string {
  if (marks.hostMarked && marks.guestMarked) {
    return styles.bingoCellMarkedBoth ?? '';
  }
  if (marks.hostMarked) {
    return styles.bingoCellMarkedHost ?? '';
  }
  if (marks.guestMarked) {
    return styles.bingoCellMarkedGuest ?? '';
  }
  return styles.bingoCellUnmarked ?? '';
}
