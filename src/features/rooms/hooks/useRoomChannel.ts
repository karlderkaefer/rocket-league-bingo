import { useEffect, useRef, useState, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface BroadcastPayload {
  cellIndex?: number;
  playerId?: string;
}

interface QueuedMessage {
  event: string;
  payload: BroadcastPayload;
}

export interface RoomChannelHook {
  connectionState: ConnectionState;
  isConnected: boolean;
  send: (event: string, payload: BroadcastPayload) => void;
  pendingQueue: BroadcastPayload[];
  retry: () => void;
  unsubscribe: () => void;
}

const MAX_RETRIES = 3;
const BACKOFF_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s

/**
 * Hook that manages a Supabase Realtime Broadcast channel for a room.
 *
 * - Subscribes to `room:{roomId}` on mount
 * - Handles mark, unmark, player-joined, room-ended events
 * - Tracks connection state with auto-retry (3 attempts, exponential backoff)
 * - Queues outgoing messages during disconnection, flushes on reconnect
 * - Exposes manual retry when all auto-retries are exhausted
 */
export function useRoomChannel(
  roomId: string,
  onMessage: (event: string, payload: BroadcastPayload) => void
): RoomChannelHook {
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [pendingQueue, setPendingQueue] = useState<BroadcastPayload[]>([]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<QueuedMessage[]>([]);
  const onMessageRef = useRef(onMessage);
  const roomIdRef = useRef(roomId);
  const subscribeRef = useRef<() => void>(() => {});

  // Keep callback ref in sync without triggering re-subscriptions
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  const flushQueue = useCallback((channel: RealtimeChannel) => {
    const queued = [...queueRef.current];
    queueRef.current = [];
    setPendingQueue([]);

    for (const msg of queued) {
      channel.send({
        type: 'broadcast',
        event: msg.event,
        payload: msg.payload,
      });
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    if (retryCountRef.current < MAX_RETRIES) {
      setConnectionState('disconnected');
      const delay = BACKOFF_DELAYS[retryCountRef.current] ?? 4000;
      retryCountRef.current += 1;

      retryTimeoutRef.current = setTimeout(() => {
        subscribeRef.current();
      }, delay);
    } else {
      setConnectionState('error');
    }
  }, []);

  const subscribe = useCallback(() => {
    // Clean up any existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setConnectionState('connecting');

    const channel = supabase.channel(`room:${roomIdRef.current}`);

    channel
      .on('broadcast', { event: 'mark' }, ({ payload }) => {
        onMessageRef.current('mark', payload as BroadcastPayload);
      })
      .on('broadcast', { event: 'unmark' }, ({ payload }) => {
        onMessageRef.current('unmark', payload as BroadcastPayload);
      })
      .on('broadcast', { event: 'player-joined' }, ({ payload }) => {
        onMessageRef.current('player-joined', payload as BroadcastPayload);
      })
      .on('broadcast', { event: 'room-ended' }, () => {
        onMessageRef.current('room-ended', {});
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          setConnectionState('connected');
          retryCountRef.current = 0;
          flushQueue(channel);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Realtime channel error:', err);
          handleDisconnect();
        } else if (status === 'CLOSED') {
          handleDisconnect();
        }
      });

    channelRef.current = channel;
  }, [flushQueue, handleDisconnect]);

  // Keep the ref in sync so handleDisconnect can call subscribe without circular deps
  useEffect(() => {
    subscribeRef.current = subscribe;
  }, [subscribe]);

  // Use a ref for connection state in send() to avoid stale closure issues
  const connectionStateRef = useRef(connectionState);
  useEffect(() => {
    connectionStateRef.current = connectionState;
  }, [connectionState]);

  const send = useCallback((event: string, payload: BroadcastPayload) => {
    const channel = channelRef.current;

    if (channel && connectionStateRef.current === 'connected') {
      channel.send({
        type: 'broadcast',
        event,
        payload,
      });
    } else {
      // Queue message during disconnection
      const msg: QueuedMessage = { event, payload };
      queueRef.current = [...queueRef.current, msg];
      setPendingQueue((prev) => [...prev, payload]);
    }
  }, []);

  const retry = useCallback(() => {
    retryCountRef.current = 0;
    subscribe();
  }, [subscribe]);

  /**
   * Manually unsubscribe from the channel.
   * Used when the room ends (completed/expired) — no further realtime events needed.
   */
  const unsubscribe = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setConnectionState('disconnected');
  }, []);

  // Subscribe on mount, cleanup on unmount
  useEffect(() => {
    subscribe();

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [subscribe]);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    send,
    pendingQueue,
    retry,
    unsubscribe,
  };
}
