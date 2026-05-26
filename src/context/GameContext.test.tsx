import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import React from 'react';
import { GameProvider, useGame } from './GameContext';
import * as persistenceAdapter from '../logic/persistenceAdapter';
import * as connectionManagerModule from '../network/connectionManager';
import type { PersistedState } from '../types';

// Mock the connection manager module
vi.mock('../network/connectionManager', () => ({
  createConnectionManager: vi.fn(),
}));

// Helper component to access context values
function TestConsumer({ onRender }: { onRender: (ctx: ReturnType<typeof useGame>) => void }) {
  const ctx = useGame();
  onRender(ctx);
  return null;
}

// Wrap with MemoryRouter since GameProvider doesn't need routing itself
function renderWithProvider(onRender: (ctx: ReturnType<typeof useGame>) => void) {
  return render(
    <GameProvider>
      <TestConsumer onRender={onRender} />
    </GameProvider>
  );
}

describe('GameContext persistence lifecycle', () => {
  let mockManager: {
    createRoom: ReturnType<typeof vi.fn>;
    joinRoom: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    onMessage: ReturnType<typeof vi.fn>;
    onConnect: ReturnType<typeof vi.fn>;
    onDisconnect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    isConnected: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    localStorage.clear();

    mockManager = {
      createRoom: vi.fn().mockResolvedValue({ peerId: 'rlb-test-peer' }),
      joinRoom: vi.fn().mockResolvedValue(undefined),
      send: vi.fn(),
      onMessage: vi.fn(),
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(false),
    };

    vi.mocked(connectionManagerModule.createConnectionManager).mockReturnValue(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restores game state from localStorage on mount', async () => {
    const persisted: PersistedState = {
      seed: 'test-seed-123',
      categoryIds: ['shot-speeds', 'shot-types', 'game-events'],
      marks: Array.from({ length: 25 }, (_, i) =>
        i === 0 ? { hostMarked: true, guestMarked: false } : { hostMarked: false, guestMarked: false }
      ),
      myRole: 'host',
      peerId: 'rlb-test-peer',
      remotePeerId: 'remote-peer-id',
      timestamp: Date.now(),
    };

    // Pre-populate localStorage
    localStorage.setItem('rlb-game-state', JSON.stringify(persisted));

    let capturedCtx: ReturnType<typeof useGame> | null = null;

    await act(async () => {
      renderWithProvider((ctx) => {
        capturedCtx = ctx;
      });
    });

    // State should be restored
    expect(capturedCtx!.state.board).not.toBeNull();
    expect(capturedCtx!.state.seed).toBe('test-seed-123');
    expect(capturedCtx!.state.myRole).toBe('host');
    expect(capturedCtx!.state.marks[0]!.hostMarked).toBe(true);
  });

  it('attempts reconnection with stored remotePeerId on restore', async () => {
    const persisted: PersistedState = {
      seed: 'test-seed-123',
      categoryIds: ['shot-speeds', 'shot-types', 'game-events'],
      marks: Array.from({ length: 25 }, () => ({ hostMarked: false, guestMarked: false })),
      myRole: 'guest',
      peerId: 'rlb-local-peer',
      remotePeerId: 'rlb-remote-host',
      timestamp: Date.now(),
    };

    localStorage.setItem('rlb-game-state', JSON.stringify(persisted));

    let capturedCtx: ReturnType<typeof useGame> | null = null;

    await act(async () => {
      renderWithProvider((ctx) => {
        capturedCtx = ctx;
      });
    });

    // Should have created a connection manager and attempted to join
    expect(connectionManagerModule.createConnectionManager).toHaveBeenCalledWith('test-seed-123');
    expect(mockManager.joinRoom).toHaveBeenCalledWith('rlb-remote-host');
    expect(mockManager.onMessage).toHaveBeenCalled();
    expect(mockManager.onConnect).toHaveBeenCalled();
    expect(mockManager.onDisconnect).toHaveBeenCalled();
  });

  it('sets connectionStatus to disconnected when reconnection fails', async () => {
    mockManager.joinRoom.mockRejectedValue(new Error('Connection failed'));

    const persisted: PersistedState = {
      seed: 'test-seed-123',
      categoryIds: ['shot-speeds', 'shot-types', 'game-events'],
      marks: Array.from({ length: 25 }, () => ({ hostMarked: false, guestMarked: false })),
      myRole: 'guest',
      peerId: 'rlb-local-peer',
      remotePeerId: 'rlb-remote-host',
      timestamp: Date.now(),
    };

    localStorage.setItem('rlb-game-state', JSON.stringify(persisted));

    let capturedCtx: ReturnType<typeof useGame> | null = null;

    await act(async () => {
      renderWithProvider((ctx) => {
        capturedCtx = ctx;
      });
    });

    // After failed reconnection, status should be disconnected
    await waitFor(() => {
      expect(capturedCtx!.connectionStatus).toBe('disconnected');
    });

    // But state should still be restored (game playable offline)
    expect(capturedCtx!.state.board).not.toBeNull();
  });

  it('does not attempt reconnection when no remotePeerId is stored', async () => {
    const persisted: PersistedState = {
      seed: 'test-seed-123',
      categoryIds: ['shot-speeds', 'shot-types', 'game-events'],
      marks: Array.from({ length: 25 }, () => ({ hostMarked: false, guestMarked: false })),
      myRole: 'host',
      peerId: 'rlb-local-peer',
      remotePeerId: '',
      timestamp: Date.now(),
    };

    localStorage.setItem('rlb-game-state', JSON.stringify(persisted));

    await act(async () => {
      renderWithProvider(() => {});
    });

    // Should not attempt to join a room (no remote peer to connect to)
    expect(mockManager.joinRoom).not.toHaveBeenCalled();
  });

  it('does not restore state when localStorage is empty', async () => {
    let capturedCtx: ReturnType<typeof useGame> | null = null;

    await act(async () => {
      renderWithProvider((ctx) => {
        capturedCtx = ctx;
      });
    });

    // State should be initial (no board)
    expect(capturedCtx!.state.board).toBeNull();
    expect(capturedCtx!.connectionStatus).toBe('disconnected');
  });

  it('handles corrupted localStorage gracefully', async () => {
    // Store corrupted data
    localStorage.setItem('rlb-game-state', 'not-valid-json{{{');

    let capturedCtx: ReturnType<typeof useGame> | null = null;

    await act(async () => {
      renderWithProvider((ctx) => {
        capturedCtx = ctx;
      });
    });

    // State should be initial (corrupted data discarded)
    expect(capturedCtx!.state.board).toBeNull();
    expect(capturedCtx!.connectionStatus).toBe('disconnected');
    // Corrupted data should be cleared
    expect(localStorage.getItem('rlb-game-state')).toBeNull();
  });

  it('clears persisted state when creating a new room', async () => {
    // Pre-populate localStorage with old game state
    const persisted: PersistedState = {
      seed: 'old-seed',
      categoryIds: ['shot-speeds'],
      marks: Array.from({ length: 25 }, () => ({ hostMarked: false, guestMarked: false })),
      myRole: 'host',
      peerId: 'old-peer',
      remotePeerId: '',
      timestamp: Date.now() - 100000,
    };
    localStorage.setItem('rlb-game-state', JSON.stringify(persisted));

    const clearSpy = vi.spyOn(persistenceAdapter, 'clearGameState');

    let capturedCtx: ReturnType<typeof useGame> | null = null;

    await act(async () => {
      renderWithProvider((ctx) => {
        capturedCtx = ctx;
      });
    });

    // Create a new room
    await act(async () => {
      await capturedCtx!.createRoom('new-seed', ['shot-speeds', 'shot-types', 'game-events']);
    });

    // clearGameState should have been called
    expect(clearSpy).toHaveBeenCalled();
  });

  it('clears persisted state when joining a room', async () => {
    const clearSpy = vi.spyOn(persistenceAdapter, 'clearGameState');

    let capturedCtx: ReturnType<typeof useGame> | null = null;

    await act(async () => {
      renderWithProvider((ctx) => {
        capturedCtx = ctx;
      });
    });

    // Use a valid 22-char base62 seed to produce a valid share code
    const { encodeShareCode } = await import('../logic/shareCodeCodec');
    const validSeed = '0000000000000000000001'; // 22 chars, valid base62
    const shareCode = encodeShareCode({
      peerId: `rlb-${validSeed}`,
      seed: validSeed,
      categoryIds: ['shot-speeds', 'shot-types', 'game-events'],
    });

    await act(async () => {
      await capturedCtx!.joinRoom(shareCode);
    });

    expect(clearSpy).toHaveBeenCalled();
  });
});
