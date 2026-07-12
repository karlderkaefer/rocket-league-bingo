import type { PlayerRole } from '@/features/game/reducer';
import { usePlayerName } from '@/features/auth/hooks/usePlayerName';

interface PlayerPresenceProps {
  myRole: PlayerRole;
  isConnected: boolean;
  opponentName?: string | null;
}

/**
 * Shows which players are in the game session.
 * Displays as compact pills in the header area.
 */
export function PlayerPresence({ myRole, isConnected, opponentName }: PlayerPresenceProps) {
  const playerName = usePlayerName() || 'You';
  const opponentLabel = opponentName || (myRole === 'host' ? 'Guest' : 'Host');

  return (
    <div className="flex items-center gap-2 text-xs">
      {/* Current player */}
      <div className="flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-400/40 px-2 py-0.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        <span className="text-sky-700 dark:text-sky-300 font-medium">{playerName}</span>
      </div>

      {/* Opponent */}
      <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-400/40 px-2 py-0.5">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
          aria-hidden="true"
        />
        <span className="text-amber-700 dark:text-amber-300">
          {opponentLabel}
        </span>
      </div>
    </div>
  );
}
