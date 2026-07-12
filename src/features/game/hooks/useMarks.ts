import { useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { withRetry } from '@/lib/retry';
import { getMarksForRoom } from '@/features/game/queries';
import type { Mark } from '@/lib/supabase/types';

/**
 * Hook providing mark persistence operations with retry logic.
 *
 * Functions: insertMark, deleteMark, loadMarks
 * All write operations use retry with exponential backoff (3 attempts, 1s/2s/4s).
 */
export function useMarks() {
  /**
   * Insert a mark into the database with retry logic.
   *
   * @param roomId - The room UUID
   * @param cellIndex - Cell index (0-24)
   * @param playerId - The authenticated player's user ID
   * @throws Error if all retries fail
   */
  const insertMark = useCallback(
    async (roomId: string, cellIndex: number, playerId: string): Promise<void> => {
      await withRetry(async () => {
        const { error } = await supabase.from('marks').insert({
          room_id: roomId,
          cell_index: cellIndex,
          player_id: playerId,
        });

        if (error) {
          throw new Error(`Failed to insert mark: ${error.message}`);
        }
      });
    },
    []
  );

  /**
   * Delete a mark from the database with retry logic.
   *
   * @param roomId - The room UUID
   * @param cellIndex - Cell index (0-24)
   * @param playerId - The authenticated player's user ID
   * @throws Error if all retries fail
   */
  const deleteMark = useCallback(
    async (roomId: string, cellIndex: number, playerId: string): Promise<void> => {
      await withRetry(async () => {
        const { error } = await supabase
          .from('marks')
          .delete()
          .eq('room_id', roomId)
          .eq('cell_index', cellIndex)
          .eq('player_id', playerId);

        if (error) {
          throw new Error(`Failed to delete mark: ${error.message}`);
        }
      });
    },
    []
  );

  /**
   * Load all marks for a room from the database.
   *
   * @param roomId - The room UUID
   * @returns Array of mark records
   * @throws Error if the database query fails
   */
  const loadMarks = useCallback(
    async (roomId: string): Promise<Mark[]> => {
      return getMarksForRoom(roomId);
    },
    []
  );

  return { insertMark, deleteMark, loadMarks };
}
