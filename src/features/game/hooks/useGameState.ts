import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useAuthContext } from '@/app/providers';
import { getRoomById } from '@/features/rooms/queries';
import { endGame as endGameAction } from '@/features/rooms/actions';
import { useMarks } from '@/features/game/hooks/useMarks';
import { generateBoard } from '@/lib/board-generator';
import type { CellMarks } from '@/lib/bingo-detector';
import type { Mark } from '@/lib/supabase/types';
import {
  useRoomChannel,
  type BroadcastPayload,
  type ConnectionState,
} from '@/features/rooms/hooks/useRoomChannel';
import {
  gameReducer,
  createInitialState,
  type GameState,
  type PlayerRole,
} from '@/features/game/reducer';

export type { ConnectionState } from '@/features/rooms/hooks/useRoomChannel';

export interface UseGameStateReturn {
  state: GameState;
  markCell: (cellIndex: number) => void;
  unmarkCell: (cellIndex: number) => void;
  endGame: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  connectionState: ConnectionState;
  isConnected: boolean;
  retryConnection: () => void;
  cellErrors: Set<number>;
  retryFailedMarks: () => void;
  shareCode: string | null;
}

/**
 * Derive CellMarks array from database mark rows.
 */
function deriveMarks(
  dbMarks: Mark[],
  hostId: string,
  guestId: string | null,
  cellCount: number = 25
): CellMarks[] {
  const result: CellMarks[] = Array.from({ length: cellCount }, () => ({
    hostMarked: false,
    guestMarked: false,
  }));

  for (const mark of dbMarks) {
    const cell = result[mark.cell_index];
    if (!cell) continue;
    if (mark.player_id === hostId) {
      cell.hostMarked = true;
    } else if (mark.player_id === guestId) {
      cell.guestMarked = true;
    }
  }

  return result;
}

/**
 * Hook managing game state for a specific room.
 *
 * On mount:
 * 1. Loads room record from DB
 * 2. Determines player role (host/guest)
 * 3. Generates board from seed/categories
 * 4. Loads marks from DB
 * 5. Subscribes to realtime channel for live updates
 *
 * Exposes markCell/unmarkCell with optimistic updates,
 * parallel DB persistence and realtime broadcast.
 *
 * On received broadcast:
 * - mark/unmark: dispatches to reducer for remote player
 * - player-joined: triggers board generation (for host waiting)
 * - room-ended: transitions to completed state
 *
 * @param roomId - The room UUID to load and manage
 */
export function useGameState(roomId: string): UseGameStateReturn {
  const { user } = useAuthContext();
  const { insertMark, deleteMark, loadMarks } = useMarks();
  const [state, dispatch] = useReducer(gameReducer, createInitialState());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareCode, setShareCode] = useState<string | null>(null);

  // Track cell-level error indicators
  const [cellErrors, setCellErrors] = useState<Set<number>>(new Set());

  // Track the failed operation details for retry: cellIndex → 'mark' | 'unmark'
  const failedOpsRef = useRef<Map<number, 'mark' | 'unmark'>>(new Map());

  // Store room metadata for mark operations
  const roomRef = useRef<{
    hostId: string;
    guestId: string | null;
    myRole: PlayerRole;
  } | null>(null);

  /**
   * Determine the PlayerRole for a given playerId based on room metadata.
   */
  const resolveRole = useCallback((playerId: string): PlayerRole | null => {
    const room = roomRef.current;
    if (!room) return null;
    if (playerId === room.hostId) return 'host';
    if (playerId === room.guestId) return 'guest';
    return null;
  }, []);

  /**
   * Handle incoming realtime broadcast messages.
   */
  const handleMessage = useCallback(
    (event: string, payload: BroadcastPayload) => {
      switch (event) {
        case 'mark': {
          const { cellIndex, playerId } = payload;
          if (cellIndex == null || !playerId) return;

          // Determine the remote player's role
          const role = resolveRole(playerId);
          if (!role) return;

          // Idempotent: reducer will set mark to true (no-op if already true)
          dispatch({ type: 'MARK_CELL', cellIndex, player: role });
          break;
        }

        case 'unmark': {
          const { cellIndex, playerId } = payload;
          if (cellIndex == null || !playerId) return;

          const role = resolveRole(playerId);
          if (!role) return;

          // Idempotent: reducer will set mark to false (no-op if already false)
          dispatch({ type: 'UNMARK_CELL', cellIndex, player: role });
          break;
        }

        case 'player-joined': {
          // Guest has joined — if we're the host and board isn't generated yet,
          // update guestId in our ref so future marks resolve correctly
          const { playerId } = payload;
          if (playerId && roomRef.current) {
            roomRef.current.guestId = playerId;
          }

          // Re-generate board if not yet done (host waiting state)
          if (roomRef.current && !state.board) {
            // Board generation will happen via the initial load effect
            // This broadcast is primarily informational for the host
          }
          break;
        }

        case 'room-ended': {
          dispatch({ type: 'SET_ROOM_STATUS', status: 'completed' });
          break;
        }
      }
    },
    [resolveRole, state.board]
  );

  // Wire up the realtime channel
  const { connectionState, isConnected, send, retry, unsubscribe } = useRoomChannel(
    roomId,
    handleMessage
  );

  // Sync connection state into reducer
  useEffect(() => {
    dispatch({ type: 'SET_CONNECTED', connected: isConnected });
  }, [isConnected]);

  // Unsubscribe from realtime channel when room is completed/expired
  useEffect(() => {
    if (state.roomStatus === 'completed' || state.roomStatus === 'expired') {
      unsubscribe();
    }
  }, [state.roomStatus, unsubscribe]);

  // Load initial state from DB
  useEffect(() => {
    let cancelled = false;

    async function loadInitialState() {
      if (!user) return;

      setIsLoading(true);
      setError(null);

      try {
        // Load room record
        const room = await getRoomById(roomId);
        if (cancelled) return;

        if (!room) {
          setError('Room not found');
          setIsLoading(false);
          return;
        }

        // Determine player role
        const myRole: PlayerRole =
          room.host_id === user.id ? 'host' : 'guest';

        roomRef.current = {
          hostId: room.host_id,
          guestId: room.guest_id,
          myRole,
        };

        // Set player role and room status from DB record
        dispatch({ type: 'SET_MY_ROLE', role: myRole });
        dispatch({ type: 'SET_ROOM_STATUS', status: room.status });
        setShareCode(room.share_code);

        // Generate board from seed and categories
        const board = generateBoard({
          seed: room.seed,
          categoryIds: room.category_ids,
        });
        dispatch({ type: 'SET_BOARD', board });

        // Load marks from DB
        const dbMarks = await loadMarks(roomId);
        if (cancelled) return;

        const marks = deriveMarks(dbMarks, room.host_id, room.guest_id, board.cells.length);
        dispatch({ type: 'LOAD_MARKS', marks });

        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Failed to load game state';
        setError(message);
        setIsLoading(false);
      }
    }

    loadInitialState();

    return () => {
      cancelled = true;
    };
  }, [roomId, user, loadMarks]);

  /**
   * Mark a cell with optimistic update.
   * Dispatches MARK_CELL immediately, persists to DB AND broadcasts
   * via realtime channel in parallel.
   * On DB failure: shows error indicator on cell but keeps optimistic state.
   */
  const markCell = useCallback(
    (cellIndex: number) => {
      if (!user || !roomRef.current) return;
      if (state.roomStatus === 'completed' || state.roomStatus === 'expired') return;

      const { myRole } = roomRef.current;

      // Idempotent check: if already marked by this player, no-op
      const currentCell = state.marks[cellIndex];
      if (currentCell) {
        const alreadyMarked =
          myRole === 'host' ? currentCell.hostMarked : currentCell.guestMarked;
        if (alreadyMarked) return;
      }

      // Optimistic update
      dispatch({ type: 'MARK_CELL', cellIndex, player: myRole });

      // Clear any previous error on this cell
      setCellErrors((prev) => {
        const next = new Set(prev);
        next.delete(cellIndex);
        return next;
      });
      failedOpsRef.current.delete(cellIndex);

      // Broadcast via realtime channel (parallel with DB persist)
      send('mark', { cellIndex, playerId: user.id });

      // Persist in background with retry
      insertMark(roomId, cellIndex, user.id).catch(() => {
        // On failure: keep optimistic state, show error indicator
        setCellErrors((prev) => new Set(prev).add(cellIndex));
        failedOpsRef.current.set(cellIndex, 'mark');
      });
    },
    [roomId, user, insertMark, send, state.marks, state.roomStatus]
  );

  /**
   * Unmark a cell with optimistic update.
   * Dispatches UNMARK_CELL immediately, persists to DB AND broadcasts
   * via realtime channel in parallel.
   * On DB failure: shows error indicator on cell but keeps optimistic state.
   */
  const unmarkCell = useCallback(
    (cellIndex: number) => {
      if (!user || !roomRef.current) return;
      if (state.roomStatus === 'completed' || state.roomStatus === 'expired') return;

      const { myRole } = roomRef.current;

      // Idempotent check: if already unmarked by this player, no-op
      const currentCell = state.marks[cellIndex];
      if (currentCell) {
        const isMarked =
          myRole === 'host' ? currentCell.hostMarked : currentCell.guestMarked;
        if (!isMarked) return;
      }

      // Optimistic update
      dispatch({ type: 'UNMARK_CELL', cellIndex, player: myRole });

      // Clear any previous error on this cell
      setCellErrors((prev) => {
        const next = new Set(prev);
        next.delete(cellIndex);
        return next;
      });
      failedOpsRef.current.delete(cellIndex);

      // Broadcast via realtime channel (parallel with DB persist)
      send('unmark', { cellIndex, playerId: user.id });

      // Persist in background with retry
      deleteMark(roomId, cellIndex, user.id).catch(() => {
        // On failure: keep optimistic state, show error indicator
        setCellErrors((prev) => new Set(prev).add(cellIndex));
        failedOpsRef.current.set(cellIndex, 'unmark');
      });
    },
    [roomId, user, deleteMark, send, state.marks, state.roomStatus]
  );

  // Merge cell errors into the error state for visibility
  const combinedError =
    error ?? (cellErrors.size > 0 ? 'Some marks failed to save' : null);

  /**
   * Retry all failed mark/unmark operations.
   * Re-attempts each operation that previously failed after retries.
   * Clears errors on success, re-sets them on repeated failure.
   */
  const retryFailedMarks = useCallback(async () => {
    if (!user || cellErrors.size === 0) return;

    const failedOps = Array.from(failedOpsRef.current.entries());

    // Process sequentially to avoid overwhelming the server
    for (const [cellIndex, opType] of failedOps) {
      setCellErrors((prev) => {
        const next = new Set(prev);
        next.delete(cellIndex);
        return next;
      });
      failedOpsRef.current.delete(cellIndex);

      try {
        if (opType === 'mark') {
          await insertMark(roomId, cellIndex, user.id);
        } else {
          await deleteMark(roomId, cellIndex, user.id);
        }
      } catch {
        setCellErrors((prev) => new Set(prev).add(cellIndex));
        failedOpsRef.current.set(cellIndex, opType);
      }
    }
  }, [roomId, user, insertMark, deleteMark, cellErrors]);

  /**
   * End the game (host only).
   * Updates room status to 'completed' in DB, broadcasts room-ended event,
   * and dispatches SET_ROOM_STATUS locally.
   * If room is already completed/expired, takes no action.
   */
  const endGameFn = useCallback(async () => {
    if (!user || !roomRef.current) return;
    if (state.roomStatus === 'completed' || state.roomStatus === 'expired') return;

    try {
      // Update room status in DB
      await endGameAction(roomId);

      // Broadcast room-ended event to the other player
      send('room-ended', {});

      // Update local state
      dispatch({ type: 'SET_ROOM_STATUS', status: 'completed' });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to end game';
      setError(message);
    }
  }, [roomId, user, send, state.roomStatus]);

  return {
    state,
    markCell,
    unmarkCell,
    endGame: endGameFn,
    isLoading,
    error: combinedError,
    connectionState,
    isConnected,
    retryConnection: retry,
    cellErrors,
    retryFailedMarks,
    shareCode,
  };
}
