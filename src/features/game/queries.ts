import { supabase } from '@/lib/supabase/client';
import type { Mark } from '@/lib/supabase/types';

/**
 * Load all marks for a given room from the database.
 *
 * @param roomId - The room UUID
 * @returns Array of mark records for the room
 * @throws Error if the database query fails
 */
export async function getMarksForRoom(roomId: string): Promise<Mark[]> {
  const { data, error } = await supabase
    .from('marks')
    .select('*')
    .eq('room_id', roomId);

  if (error) {
    throw new Error(`Failed to load marks: ${error.message}`);
  }

  return data ?? [];
}
