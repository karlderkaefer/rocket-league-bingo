import type { BingoLineWithWinner, BingoWinner } from '@/lib/bingo-detector';
import type { PlayerRole } from '@/features/game/reducer';
import { getPlayerName } from '@/features/rooms/components/HomePage';

interface BingoNotificationProps {
  bingoLines: BingoLineWithWinner[];
  myRole: PlayerRole;
}

/**
 * Format a BingoLine into a human-readable label.
 */
function formatLine(line: BingoLineWithWinner): string {
  switch (line.type) {
    case 'row':
      return `Row ${line.index + 1}`;
    case 'column':
      return `Column ${line.index + 1}`;
    case 'diagonal':
      return line.index === 0 ? 'Diagonal ↘' : 'Diagonal ↙';
  }
}

/**
 * Get the display name for a winner relative to the current player.
 */
function getWinnerName(winner: BingoWinner, myRole: PlayerRole): string {
  const playerName = getPlayerName() || 'You';

  if (winner === 'both') return 'Both players';
  if (winner === myRole) return playerName;
  return 'Opponent';
}

/**
 * Celebratory notification banner displayed when bingo is achieved.
 * Shows who completed the line (which player marked all cells in it).
 */
export function BingoNotification({ bingoLines, myRole }: BingoNotificationProps) {
  if (bingoLines.length === 0) {
    return null;
  }

  // Determine the primary winner — who has the most lines
  const hostLines = bingoLines.filter((l) => l.winner === 'host').length;
  const guestLines = bingoLines.filter((l) => l.winner === 'guest').length;

  let primaryWinner: BingoWinner;
  if (hostLines > 0 && guestLines === 0) primaryWinner = 'host';
  else if (guestLines > 0 && hostLines === 0) primaryWinner = 'guest';
  else primaryWinner = 'both';

  const winnerName = getWinnerName(primaryWinner, myRole);
  const isSelf = primaryWinner === myRole;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="rounded-lg border bg-card px-4 py-3 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden="true">
          {isSelf ? '🏆' : '🎉'}
        </span>
        <div>
          <p className="font-bold text-card-foreground">
            BINGO! {winnerName === 'Both players' ? 'Both players win!' : winnerName === 'You' ? 'You win!' : `${winnerName} wins!`}
          </p>
          <p className="text-sm text-muted-foreground">
            {bingoLines.length === 1
              ? `Completed: ${formatLine(bingoLines[0]!)}`
              : `${bingoLines.length} lines: ${bingoLines.map(formatLine).join(', ')}`}
          </p>
        </div>
      </div>
    </div>
  );
}
