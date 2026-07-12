import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

import { useGameState } from '@/features/game/hooks/useGameState';
import { useBingo } from '@/features/game/hooks/useBingo';
import { BoardGrid } from '@/features/game/components/BoardGrid';
import { BoardLegend } from '@/features/game/components/BoardLegend';
import { CategoryLegend } from '@/features/game/components/CategoryLegend';
import { BingoNotification } from '@/features/game/components/BingoNotification';
import { WinCelebration } from '@/features/game/components/WinCelebration';
import { ConnectionStatus } from '@/features/game/components/ConnectionStatus';
import { PlayerPresence } from '@/features/game/components/PlayerPresence';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserMenu } from '@/features/auth/components/UserMenu';
import { Button } from '@/components/ui/button';

/**
 * Main game page component.
 *
 * On mount:
 * 1. Reads roomId from URL params (/game/:roomId)
 * 2. Calls useGameState(roomId) which handles:
 *    - Loading room record from DB
 *    - Determining player role (host/guest)
 *    - Generating board from seed + categories
 *    - Loading marks from DB
 *    - Subscribing to realtime channel
 * 3. Shows loading spinner while restoring state
 * 4. Shows error + retry if DB read fails
 * 5. Once loaded, renders ConnectionStatus, BingoNotification, and BoardGrid
 *
 * Click handler: if cell is marked by me → unmarkCell, else → markCell
 */
export function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();

  if (!roomId) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg text-destructive">
            Invalid game URL — no room ID found.
          </p>
        </div>
      </div>
    );
  }

  return <GamePageContent roomId={roomId} />;
}

interface GamePageContentProps {
  roomId: string;
}

function GamePageContent({ roomId }: GamePageContentProps) {
  const {
    state,
    markCell,
    unmarkCell,
    endGame,
    isLoading,
    error,
    connectionState,
    isConnected,
    retryConnection,
    cellErrors,
    retryFailedMarks,
    opponentName,
  } = useGameState(roomId);

  const { bingoLines, hasBingo } = useBingo(state.marks, state.board?.boardSize);

  // Fire the smoke celebration once, on the rising edge of a bingo appearing.
  const [celebrating, setCelebrating] = useState(false);
  const wasBingo = useRef(false);
  useEffect(() => {
    if (hasBingo && !wasBingo.current) {
      setCelebrating(true);
    }
    wasBingo.current = hasBingo;
  }, [hasBingo]);

  const isGameOver =
    state.roomStatus === 'completed' || state.roomStatus === 'expired';
  const isHost = state.myRole === 'host';
  const showEndGameButton = isHost && state.roomStatus === 'active';

  // Loading state while restoring from DB
  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3" role="status" aria-label="Loading game">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">
            Loading game…
          </p>
        </div>
      </div>
    );
  }

  // Error state with retry
  if (error && !state.board) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-lg text-destructive">
            {error}
          </p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Board not available (shouldn't happen if loading completed without error)
  if (!state.board) {
    return null;
  }

  /**
   * Click handler: toggle mark based on current state.
   * If cell is already marked by me → unmark, else → mark.
   * Disabled when the game is over.
   */
  function handleCellClick(cellIndex: number) {
    if (isGameOver) return;

    const cellMarks = state.marks[cellIndex];
    if (!cellMarks) return;

    const isMarkedByMe =
      state.myRole === 'host' ? cellMarks.hostMarked : cellMarks.guestMarked;

    if (isMarkedByMe) {
      unmarkCell(cellIndex);
    } else {
      markCell(cellIndex);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4">
      {/* Header with player presence */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold tracking-tight">Rocket League Bingo</h1>
        <div className="flex items-center gap-2">
          <PlayerPresence myRole={state.myRole} isConnected={isConnected} opponentName={opponentName} />
          <UserMenu />
          <ThemeToggle />
        </div>
      </div>

      {/* Connection problem indicator (only shows on disconnect/error) */}
      {!isGameOver && (
        <ConnectionStatus
          connectionState={connectionState}
          onRetry={retryConnection}
        />
      )}

      {/* Game Over message */}
      {isGameOver && (
        <div className="rounded-lg border bg-card px-4 py-3 text-center">
          <p className="text-lg font-semibold text-card-foreground">
            Game Over
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {state.roomStatus === 'expired'
              ? 'This game has expired due to inactivity.'
              : 'This game has ended.'}
          </p>
          <Link
            to="/create"
            className="mt-3 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create New Room
          </Link>
        </div>
      )}

      {/* Bingo notification */}
      <BingoNotification bingoLines={bingoLines} myRole={state.myRole} />

      {/* GPU smoke win celebration overlay */}
      <WinCelebration show={celebrating} onDone={() => setCelebrating(false)} />

      {/* Color legend */}
      <BoardLegend myRole={state.myRole} />

      {/* Category legend (collapsible) */}
      <CategoryLegend />

      {/* Error banner with retry button for failed marks */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
          {cellErrors.size > 0 && (
            <button
              type="button"
              onClick={retryFailedMarks}
              className="ml-2 shrink-0 rounded bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              Retry failed marks
            </button>
          )}
        </div>
      )}

      {/* Board grid — disabled and read-only when game is over */}
      <BoardGrid
        cells={state.board.cells}
        marks={state.marks}
        onCellClick={isGameOver ? undefined : handleCellClick}
        myRole={state.myRole}
        disabled={isGameOver}
        cellErrors={cellErrors}
        boardSize={state.board.boardSize}
      />

      {/* End Game button (Host only, active game only) */}
      {showEndGameButton && (
        <div className="flex justify-center pt-2">
          <Button
            variant="destructive"
            onClick={endGame}
            aria-label="End Game"
          >
            End Game
          </Button>
        </div>
      )}
    </div>
  );
}
