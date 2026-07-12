import { supabase } from '@/lib/supabase/client';
import type { Room } from '@/lib/supabase/types';

/**
 * Look up a room by its share code.
 *
 * @param code - The share code to look up
 * @returns The room record if found, or null
 */
export async function getRoomByShareCode(code: string): Promise<Room | null> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('share_code', code)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Look up a room by its ID.
 *
 * @param id - The room UUID
 * @returns The room record if found, or null
 */
export async function getRoomById(id: string): Promise<Room | null> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Find the most recent active or waiting room for a given user.
 * Checks both host_id and guest_id fields.
 *
 * @param userId - The authenticated user's ID
 * @returns The active room if found, or null
 */
export async function getActiveRoomForUser(
  userId: string
): Promise<Room | null> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
    .in('status', ['waiting', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}
