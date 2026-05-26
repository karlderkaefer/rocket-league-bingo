import type { BingoLine } from '../types';
import styles from './BingoNotification.module.css';

export interface BingoNotificationProps {
  bingoLines: BingoLine[];
}

/**
 * Displays a celebratory bingo notification when one or more bingo lines are detected.
 * Auto-dismisses when bingoLines becomes empty (e.g., when a bingo line is broken by unmark).
 * Uses role="alert" for accessibility so screen readers announce bingo immediately.
 */
export default function BingoNotification({ bingoLines }: BingoNotificationProps) {
  if (bingoLines.length === 0) {
    return null;
  }

  const lineCount = bingoLines.length;
  const message = lineCount === 1
    ? '🎉 BINGO! 1 line completed!'
    : `🎉 BINGO! ${lineCount} lines completed!`;

  return (
    <div className={styles.notification} role="alert">
      {message}
    </div>
  );
}
