import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// vi.mock is hoisted — cannot reference variables outside the factory.
// Instead, use vi.fn() directly and access them via the mocked module.
vi.mock('@/lib/supabase/client', () => {
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    send: vi.fn(),
    unsubscribe: vi.fn(),
  };

  return {
    supabase: {
      channel: vi.fn(() => mockChannel),
      removeChannel: vi.fn(),
    },
  };
});

import { supabase } from '@/lib/supabase/client';
import { useRoomChannel } from './useRoomChannel';

// Get typed references to our mocks
const mockSupabaseChannel = supabase.channel as Mock;
const mockRemoveChannel = supabase.removeChannel as Mock;

// Helper to get the mock channel instance
function getMockChannel() {
  return mockSupabaseChannel.mock.results[mockSupabaseChannel.mock.results.length - 1]?.value;
}

// Capture subscribe callback from the mock
function getSubscribeCallback(): ((status: string, err?: Error) => void) | undefined {
  const channel = getMockChannel();
  if (!channel) return undefined;
  const subscribeCalls = (channel.subscribe as Mock).mock.calls;
  return subscribeCalls[subscribeCalls.length - 1]?.[0];
}

// Get broadcast handlers registered via .on()
function getBroadcastHandler(event: string): ((arg: { payload: unknown }) => void) | undefined {
  const channel = getMockChannel();
  if (!channel) return undefined;
  const onCalls = (channel.on as Mock).mock.calls;
  for (const call of onCalls) {
    if (call[1]?.event === event) {
      return call[2];
    }
  }
  return undefined;
}

describe('useRoomChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Re-setup mock channel's chaining behavior after clearAllMocks
    const mockChannel = mockSupabaseChannel();
    (mockChannel.on as Mock).mockReturnThis();
    (mockChannel.subscribe as Mock).mockReturnThis();
    vi.clearAllMocks();

    // Setup fresh mock channel for each test
    const freshChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      send: vi.fn(),
      unsubscribe: vi.fn(),
    };
    mockSupabaseChannel.mockReturnValue(freshChannel);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('subscribes to the correct channel on mount', () => {
    renderHook(() => useRoomChannel('room-123', vi.fn()));

    expect(mockSupabaseChannel).toHaveBeenCalledWith('room:room-123');
    const channel = getMockChannel();
    expect(channel.subscribe).toHaveBeenCalled();
  });

  it('starts in connecting state', () => {
    const { result } = renderHook(() => useRoomChannel('room-123', vi.fn()));

    expect(result.current.connectionState).toBe('connecting');
    expect(result.current.isConnected).toBe(false);
  });

  it('transitions to connected on SUBSCRIBED status', () => {
    const { result } = renderHook(() => useRoomChannel('room-123', vi.fn()));

    const callback = getSubscribeCallback();
    act(() => {
      callback?.('SUBSCRIBED');
    });

    expect(result.current.connectionState).toBe('connected');
    expect(result.current.isConnected).toBe(true);
  });

  it('calls onMessage when broadcast events are received', () => {
    const onMessage = vi.fn();
    renderHook(() => useRoomChannel('room-123', onMessage));

    const callback = getSubscribeCallback();
    act(() => {
      callback?.('SUBSCRIBED');
    });

    // Simulate receiving a mark broadcast
    const markHandler = getBroadcastHandler('mark');
    act(() => {
      markHandler?.({ payload: { cellIndex: 5, playerId: 'player-1' } });
    });

    expect(onMessage).toHaveBeenCalledWith('mark', { cellIndex: 5, playerId: 'player-1' });
  });

  it('queues messages when not connected', () => {
    const { result } = renderHook(() => useRoomChannel('room-123', vi.fn()));

    // Stay in connecting state (not connected)
    act(() => {
      result.current.send('mark', { cellIndex: 3, playerId: 'p1' });
    });

    const channel = getMockChannel();
    expect(channel.send).not.toHaveBeenCalled();
    expect(result.current.pendingQueue).toHaveLength(1);
    expect(result.current.pendingQueue[0]).toEqual({ cellIndex: 3, playerId: 'p1' });
  });

  it('sends messages directly when connected', () => {
    const { result } = renderHook(() => useRoomChannel('room-123', vi.fn()));

    const callback = getSubscribeCallback();
    act(() => {
      callback?.('SUBSCRIBED');
    });

    act(() => {
      result.current.send('mark', { cellIndex: 7, playerId: 'p1' });
    });

    const channel = getMockChannel();
    expect(channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'mark',
      payload: { cellIndex: 7, playerId: 'p1' },
    });
  });

  it('flushes queued messages on successful subscription', () => {
    const { result } = renderHook(() => useRoomChannel('room-123', vi.fn()));

    // Queue messages while not connected
    act(() => {
      result.current.send('mark', { cellIndex: 1, playerId: 'p1' });
      result.current.send('unmark', { cellIndex: 2, playerId: 'p1' });
    });

    expect(result.current.pendingQueue).toHaveLength(2);

    // Now connect
    const callback = getSubscribeCallback();
    act(() => {
      callback?.('SUBSCRIBED');
    });

    // Queue should be flushed
    const channel = getMockChannel();
    expect(channel.send).toHaveBeenCalledTimes(2);
    expect(result.current.pendingQueue).toHaveLength(0);
  });

  it('transitions to disconnected on CHANNEL_ERROR and schedules retry', () => {
    const { result } = renderHook(() => useRoomChannel('room-123', vi.fn()));

    const callback = getSubscribeCallback();
    act(() => {
      callback?.('SUBSCRIBED');
    });
    expect(result.current.connectionState).toBe('connected');

    // Simulate channel error
    act(() => {
      callback?.('CHANNEL_ERROR', new Error('network'));
    });

    expect(result.current.connectionState).toBe('disconnected');
  });

  it('transitions to error after exhausting all 3 retries', () => {
    const { result } = renderHook(() => useRoomChannel('room-123', vi.fn()));

    // First error → retry 1
    let callback = getSubscribeCallback();
    act(() => {
      callback?.('CHANNEL_ERROR');
    });
    expect(result.current.connectionState).toBe('disconnected');

    // Advance 1s → retries → new channel created
    act(() => { vi.advanceTimersByTime(1000); });
    callback = getSubscribeCallback();

    // Second error → retry 2
    act(() => {
      callback?.('CHANNEL_ERROR');
    });
    expect(result.current.connectionState).toBe('disconnected');

    act(() => { vi.advanceTimersByTime(2000); });
    callback = getSubscribeCallback();

    // Third error → retry 3
    act(() => {
      callback?.('CHANNEL_ERROR');
    });
    expect(result.current.connectionState).toBe('disconnected');

    act(() => { vi.advanceTimersByTime(4000); });
    callback = getSubscribeCallback();

    // Fourth error → all retries exhausted
    act(() => {
      callback?.('CHANNEL_ERROR');
    });
    expect(result.current.connectionState).toBe('error');
  });

  it('manual retry resets retry count and resubscribes', () => {
    const { result } = renderHook(() => useRoomChannel('room-123', vi.fn()));

    // Exhaust retries
    let callback = getSubscribeCallback();
    act(() => { callback?.('CHANNEL_ERROR'); });
    act(() => { vi.advanceTimersByTime(1000); });
    callback = getSubscribeCallback();
    act(() => { callback?.('CHANNEL_ERROR'); });
    act(() => { vi.advanceTimersByTime(2000); });
    callback = getSubscribeCallback();
    act(() => { callback?.('CHANNEL_ERROR'); });
    act(() => { vi.advanceTimersByTime(4000); });
    callback = getSubscribeCallback();
    act(() => { callback?.('CHANNEL_ERROR'); });

    expect(result.current.connectionState).toBe('error');

    // Manual retry
    act(() => {
      result.current.retry();
    });

    expect(result.current.connectionState).toBe('connecting');
  });

  it('unsubscribes from channel on unmount', () => {
    const { unmount } = renderHook(() => useRoomChannel('room-123', vi.fn()));

    const channel = getMockChannel();
    unmount();

    expect(mockRemoveChannel).toHaveBeenCalledWith(channel);
  });

  it('handles room-ended broadcast event', () => {
    const onMessage = vi.fn();
    renderHook(() => useRoomChannel('room-123', onMessage));

    const callback = getSubscribeCallback();
    act(() => {
      callback?.('SUBSCRIBED');
    });

    const handler = getBroadcastHandler('room-ended');
    act(() => {
      handler?.({ payload: {} });
    });

    expect(onMessage).toHaveBeenCalledWith('room-ended', {});
  });

  it('handles player-joined broadcast event', () => {
    const onMessage = vi.fn();
    renderHook(() => useRoomChannel('room-123', onMessage));

    const callback = getSubscribeCallback();
    act(() => {
      callback?.('SUBSCRIBED');
    });

    const handler = getBroadcastHandler('player-joined');
    act(() => {
      handler?.({ payload: { playerId: 'guest-1' } });
    });

    expect(onMessage).toHaveBeenCalledWith('player-joined', { playerId: 'guest-1' });
  });
});
