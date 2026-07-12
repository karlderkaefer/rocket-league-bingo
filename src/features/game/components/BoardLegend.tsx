import type { PlayerRole } from '@/features/game/reducer';
import { usePlayerName } from '@/features/auth/hooks/usePlayerName';

interface BoardLegendProps {
  myRole: PlayerRole;
}

/**
 * Color legend showing which color represents which player.
 * "Both" is shown as a diagonal split of both colors.
 */
export function BoardLegend({ myRole }: BoardLegendProps) {
  const playerName = usePlayerName() || 'You';
  const opponentLabel = 'Opponent';

  const myColor = myRole === 'host'
    ? 'bg-sky-500/20 border-sky-400/60'
    : 'bg-amber-500/20 border-amber-400/60';

  const opponentColor = myRole === 'host'
    ? 'bg-amber-500/20 border-amber-400/60'
    : 'bg-sky-500/20 border-sky-400/60';

  return (
    <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span className={`inline-block h-3 w-3 rounded-sm border ${myColor}`} />
        <span>{playerName}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`inline-block h-3 w-3 rounded-sm border ${opponentColor}`} />
        <span>{opponentLabel}</span>
      </div>
    </div>
  );
}
