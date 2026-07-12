import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { supabase } from '@/lib/supabase/client';
import { useRoom } from '@/features/rooms/hooks/useRoom';
import { CategorySelector } from '@/features/categories/components/CategorySelector';
import { ShareCodePanel } from '@/features/rooms/components/ShareCodePanel';
import { buildShareUrl } from '@/lib/share-code';

/**
 * CreateRoomPage flow:
 * 1. Show CategorySelector
 * 2. On confirm → call create(categoryIds)
 * 3. On success → show ShareCodePanel with share code + waiting indicator
 * 4. Subscribe to room's Broadcast channel for `player-joined` event
 * 5. When guest joins → navigate to /game/:roomId
 */
export function CreateRoomPage() {
  const navigate = useNavigate();
  const { room, create, shareCode, isLoading, error, clearError, isWaiting, isActive } = useRoom();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Subscribe to realtime Postgres Changes when room is created (waiting for guest)
  // When the guest joins, the room status changes from 'waiting' to 'active' in the DB.
  // This is more reliable than Broadcast because it's triggered by the actual DB update.
  useEffect(() => {
    if (!room || !isWaiting) return;

    const channel = supabase
      .channel(`room-status:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          if (payload.new && (payload.new as { status: string }).status === 'active') {
            navigate(`/game/${room.id}`);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [room, isWaiting, navigate]);

  // Navigate to game when guest joins (room becomes active via local state)
  useEffect(() => {
    if (isActive && room) {
      navigate(`/game/${room.id}`);
    }
  }, [isActive, room, navigate]);

  // Show share code panel after room is created
  if (room && shareCode) {
    const shareUrl = buildShareUrl(shareCode);

    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-4 py-8">
        <h1 className="text-center text-2xl font-bold">Room Created</h1>

        <ShareCodePanel shareCode={shareCode} shareUrl={shareUrl} />

        {isWaiting && (
          <div className="flex flex-col items-center gap-2">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              Waiting for opponent to join...
            </p>
          </div>
        )}

        {error && (
          <p className="text-center text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }

  // Show category selection
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-4 py-8">
      <h1 className="text-center text-2xl font-bold">Create a Room</h1>
      <p className="text-center text-sm text-muted-foreground">
        Select categories for your bingo board
      </p>

      {error && (
        <div className="flex items-center justify-between rounded-lg bg-destructive/10 px-4 py-2">
          <p className="text-sm text-destructive">{error}</p>
          <button
            onClick={clearError}
            className="text-sm text-destructive underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <CategorySelector onConfirm={create} isLoading={isLoading} />
    </div>
  );
}
