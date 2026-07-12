import { supabase } from '@/lib/supabase/client';
import { encodeShareCode } from '@/lib/share-code';
import type { Room } from '@/lib/supabase/types';

interface CreateRoomParams {
  categoryIds: string[];
  hostId: string;
}

interface CreateRoomResult {
  roomId: string;
  shareCode: string;
}

/**
 * Generate a 128-bit random seed encoded as base62.
 * Uses crypto.getRandomValues for cryptographic randomness.
 * Converts 128-bit value to base62 via BigInt division (unbiased).
 */
function generateSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const BASE62_CHARS =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

  // Convert bytes to a BigInt
  let num = 0n;
  for (const byte of bytes) {
    num = (num << 8n) | BigInt(byte);
  }

  // Convert BigInt to base62 string (unbiased)
  let result = '';
  while (num > 0n) {
    result = BASE62_CHARS[Number(num % 62n)]! + result;
    num = num / 62n;
  }

  // Pad to at least 22 chars (128 bits in base62 = ~21.5 chars)
  return result.padStart(22, '0');
}

/**
 * Create a new game room.
 *
 * Generates a cryptographic seed, creates a room record in the database,
 * and returns the room ID along with a share code for the guest to join.
 *
 * @param params - The room creation parameters (categoryIds, hostId)
 * @returns The roomId and shareCode for the newly created room
 * @throws Error if the database insert fails
 */
export async function createRoom(
  params: CreateRoomParams
): Promise<CreateRoomResult> {
  const seed = generateSeed();
  const roomId = crypto.randomUUID();
  const shareCode = encodeShareCode(roomId);

  const { error } = await supabase.from('rooms').insert({
    id: roomId,
    host_id: params.hostId,
    seed,
    category_ids: params.categoryIds,
    share_code: shareCode,
    status: 'waiting',
  });

  if (error) {
    throw new Error(`Room creation failed: ${error.message}`);
  }

  return { roomId, shareCode };
}

/**
 * Join an existing room by share code.
 *
 * Looks up the room by share_code, then atomically sets the guest_id
 * and transitions the status from 'waiting' to 'active'.
 *
 * @param shareCode - The share code identifying the room
 * @param guestId - The authenticated user ID of the joining guest
 * @returns The updated room record
 * @throws Error if the room is not found, unavailable, or update fails
 */
export async function joinRoom(
  shareCode: string,
  guestId: string
): Promise<Room> {
  // Look up the room by share code
  // First try: standard lookup (RLS allows reading 'waiting' rooms for anyone)
  const { data: room, error: lookupError } = await supabase
    .from('rooms')
    .select('*')
    .eq('share_code', shareCode)
    .maybeSingle();

  if (lookupError) {
    throw new Error('Failed to look up room. Please try again.');
  }

  if (!room) {
    // Room not found could mean: invalid code, OR the room is active/completed
    // (RLS hides non-waiting rooms from non-participants)
    throw new Error('Room not found. The code may be invalid, or the game has already started.');
  }

  if (room.host_id === guestId) {
    throw new Error('You cannot join your own room.');
  }

  if (room.status !== 'waiting') {
    throw new Error('This room is no longer available. The game has already started.');
  }

  if (room.guest_id !== null) {
    throw new Error('This room already has a guest.');
  }

  // Atomically claim the room as guest
  const { data: updatedRoom, error: updateError } = await supabase
    .from('rooms')
    .update({
      guest_id: guestId,
      status: 'active',
    })
    .eq('id', room.id)
    .eq('status', 'waiting')
    .is('guest_id', null)
    .select()
    .single();

  if (updateError || !updatedRoom) {
    throw new Error(
      'Failed to join room. It may have been claimed by another player.'
    );
  }

  return updatedRoom;
}

/**
 * End an active game by updating the room status to 'completed'.
 *
 * Only the host should call this. RLS policies enforce that only the host
 * can update the room status.
 *
 * @param roomId - The room ID to end
 * @throws Error if the update fails or room is already ended
 */
export async function endGame(roomId: string): Promise<void> {
  const { error } = await supabase
    .from('rooms')
    .update({ status: 'completed' })
    .eq('id', roomId)
    .in('status', ['waiting', 'active']);

  if (error) {
    throw new Error(`Failed to end game: ${error.message}`);
  }
}
