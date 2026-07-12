import { useState, useCallback } from 'react';

import { useAuthContext } from '@/app/providers';
import { supabase } from '@/lib/supabase/client';
import { createRoom, joinRoom, endGame } from '@/features/rooms/actions';
import { shareCodeSchema } from '@/features/rooms/schemas';
import type { Room } from '@/features/rooms/types';

export interface UseRoomReturn {
  // Room state
  room: Room | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  create: (categoryIds: string[]) => Promise<void>;
  join: (shareCode: string) => Promise<void>;
  end: () => Promise<void>;
  clearError: () => void;

  // Derived
  shareCode: string | null;
  isHost: boolean;
  isWaiting: boolean;
  isActive: boolean;
}

/**
 * Hook for managing room state: creation, joining, ending, and derived status.
 *
 * Integrates with auth context for current user identity.
 * Handles loading states and user-friendly error messages.
 */
export function useRoom(): UseRoomReturn {
  const { user } = useAuthContext();

  const [room, setRoom] = useState<Room | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const create = useCallback(
    async (categoryIds: string[], boardSize: number = 5) => {
      if (!user) {
        setError('You must be signed in to create a room.');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Encode board size as a special entry in category_ids
        const categoryIdsWithSize = [`_board:${boardSize}`, ...categoryIds];

        const result = await createRoom({
          categoryIds: categoryIdsWithSize,
          hostId: user.id,
        });

        // Build a local Room object from the creation result
        setRoom({
          id: result.roomId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          host_id: user.id,
          guest_id: null,
          seed: '',
          category_ids: categoryIdsWithSize,
          share_code: result.shareCode,
          status: 'waiting',
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Room creation failed. Please try again.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  const join = useCallback(
    async (shareCode: string) => {
      if (!user) {
        setError('You must be signed in to join a room.');
        return;
      }

      // Validate share code format before making a network request
      const validation = shareCodeSchema.safeParse(shareCode);
      if (!validation.success) {
        setError(validation.error.issues[0]?.message ?? 'Invalid share code.');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const joinedRoom = await joinRoom(shareCode, user.id);
        setRoom(joinedRoom);

        // Broadcast player-joined to notify the host (best-effort, with timeout)
        // The host also subscribes to Postgres Changes on the room, so this is a
        // redundant notification — if it fails, the host still detects the join.
        const channel = supabase.channel(`room:${joinedRoom.id}`);
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            supabase.removeChannel(channel);
            resolve();
          }, 3000);

          channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              channel.send({
                type: 'broadcast',
                event: 'player-joined',
                payload: { playerId: user.id },
              });
              setTimeout(() => {
                clearTimeout(timeout);
                supabase.removeChannel(channel);
                resolve();
              }, 200);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              clearTimeout(timeout);
              supabase.removeChannel(channel);
              resolve(); // Don't block the join flow on broadcast failure
            }
          });
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to join room. Please try again.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  const end = useCallback(async () => {
    if (!room) {
      setError('No active room to end.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await endGame(room.id);
      setRoom((prev) =>
        prev ? { ...prev, status: 'completed' as const } : null
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to end game. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [room]);

  // Derived state
  const shareCode = room?.share_code ?? null;
  const isHost = Boolean(user && room && room.host_id === user.id);
  const isWaiting = room?.status === 'waiting';
  const isActive = room?.status === 'active';

  return {
    room,
    isLoading,
    error,
    create,
    join,
    end,
    clearError,
    shareCode,
    isHost,
    isWaiting,
    isActive,
  };
}
