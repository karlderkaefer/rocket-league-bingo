import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PeerConnectionManager,
  ConnectionTimeoutError,
  PeerUnavailableError,
} from './connectionManager';
import type { GameMessage } from '../types';

// --- PeerJS Mocks ---

type EventHandler = (...args: unknown[]) => void;

function createMockDataConnection() {
  const handlers: Record<string, EventHandler[]> = {};
  return {
    open: true,
    peer: 'remote-peer-id',
    on: vi.fn((event: string, handler: EventHandler) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }),
    send: vi.fn(),
    close: vi.fn(),
    _emit(event: string, ...args: unknown[]) {
      for (const handler of handlers[event] || []) {
        handler(...args);
      }
    },
    _handlers: handlers,
  };
}

function createMockPeer(peerId = 'rlb-test-seed') {
  const handlers: Record<string, EventHandler[]> = {};
  return {
    id: peerId,
    destroyed: false,
    disconnected: false,
    on: vi.fn((event: string, handler: EventHandler) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }),
    connect: vi.fn(() => createMockDataConnection()),
    destroy: vi.fn(function (this: { destroyed: boolean }) {
      this.destroyed = true;
    }),
    reconnect: vi.fn(),
    _emit(event: string, ...args: unknown[]) {
      for (const handler of handlers[event] || []) {
        handler(...args);
      }
    },
    _handlers: handlers,
  };
}

let mockPeerInstance: ReturnType<typeof createMockPeer>;

vi.mock('peerjs', () => {
  return {
    default: class MockPeer {
      id: string;
      destroyed: boolean;
      disconnected: boolean;
      on: ReturnType<typeof vi.fn>;
      connect: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
      reconnect: ReturnType<typeof vi.fn>;
      _emit: (event: string, ...args: unknown[]) => void;
      _handlers: Record<string, EventHandler[]>;

      constructor(_id?: string) {
        // Copy all properties from the mock instance
        this.id = mockPeerInstance.id;
        this.destroyed = mockPeerInstance.destroyed;
        this.disconnected = mockPeerInstance.disconnected;
        this.on = mockPeerInstance.on;
        this.connect = mockPeerInstance.connect;
        this.destroy = mockPeerInstance.destroy;
        this.reconnect = mockPeerInstance.reconnect;
        this._emit = mockPeerInstance._emit;
        this._handlers = mockPeerInstance._handlers;
      }
    },
  };
});

describe('PeerConnectionManager', () => {
  let manager: PeerConnectionManager;

  beforeEach(() => {
    vi.useFakeTimers();
    mockPeerInstance = createMockPeer();
    manager = new PeerConnectionManager('test-seed');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('createRoom()', () => {
    it('resolves with peerId when open event fires', async () => {
      const promise = manager.createRoom();

      // Simulate PeerJS 'open' event
      mockPeerInstance._emit('open', 'rlb-test-seed');

      const result = await promise;
      expect(result).toEqual({ peerId: 'rlb-test-seed' });
    });

    it('rejects with ConnectionTimeoutError after 10 seconds', async () => {
      const promise = manager.createRoom();

      // Advance time past the 10s timeout
      vi.advanceTimersByTime(10000);

      await expect(promise).rejects.toThrow(ConnectionTimeoutError);
      await expect(promise).rejects.toThrow(
        'Could not connect to signaling server. Check your internet connection.'
      );
    });

    it('rejects with error when peer error event fires', async () => {
      const promise = manager.createRoom();

      mockPeerInstance._emit('error', {
        type: 'server-error',
        message: 'Server error',
      });

      await expect(promise).rejects.toThrow(ConnectionTimeoutError);
    });
  });

  describe('joinRoom()', () => {
    it('resolves when connection opens', async () => {
      const mockConn = createMockDataConnection();
      mockPeerInstance.connect.mockReturnValue(mockConn);

      const promise = manager.joinRoom('rlb-host-peer');

      // First, peer opens
      mockPeerInstance._emit('open', 'guest-peer-id');

      // Then connection opens
      mockConn._emit('open');

      await expect(promise).resolves.toBeUndefined();
    });

    it('rejects with ConnectionTimeoutError after 15 seconds', async () => {
      const promise = manager.joinRoom('rlb-host-peer');

      // Advance time past the 15s timeout
      vi.advanceTimersByTime(15000);

      await expect(promise).rejects.toThrow(ConnectionTimeoutError);
      await expect(promise).rejects.toThrow(
        'Host is unreachable. They may have closed the room.'
      );
    });

    it('rejects with PeerUnavailableError when peer-unavailable error fires', async () => {
      const promise = manager.joinRoom('rlb-host-peer');

      mockPeerInstance._emit('error', {
        type: 'peer-unavailable',
        message: 'Peer unavailable',
      });

      await expect(promise).rejects.toThrow(PeerUnavailableError);
    });

    it('rejects with error when connection error fires', async () => {
      const mockConn = createMockDataConnection();
      mockPeerInstance.connect.mockReturnValue(mockConn);

      const promise = manager.joinRoom('rlb-host-peer');

      // Peer opens
      mockPeerInstance._emit('open', 'guest-peer-id');

      // Connection error
      mockConn._emit('error', new Error('Connection failed'));

      await expect(promise).rejects.toThrow('Connection error');
    });
  });

  describe('Room-full rejection', () => {
    it('host sends REJECT message to second guest when room is full', async () => {
      // Set up host
      const createPromise = manager.createRoom();
      mockPeerInstance._emit('open', 'rlb-test-seed');
      await createPromise;

      // First guest connects
      const firstConn = createMockDataConnection();
      firstConn.peer = 'guest-1';

      // Simulate the 'connection' event on the peer
      const connectionHandler = mockPeerInstance._handlers['connection']?.[0];
      expect(connectionHandler).toBeDefined();

      // First guest connects and opens
      connectionHandler!(firstConn);
      firstConn._emit('open');

      // Second guest tries to connect
      const secondConn = createMockDataConnection();
      secondConn.peer = 'guest-2';
      connectionHandler!(secondConn);
      secondConn._emit('open');

      // The host should send a REJECT message to the second guest
      expect(secondConn.send).toHaveBeenCalledWith({
        type: 'REJECT',
        reason: 'room-full',
      });
    });
  });

  describe('send()', () => {
    it('sends message via connection', async () => {
      const mockConn = createMockDataConnection();
      mockPeerInstance.connect.mockReturnValue(mockConn);

      const promise = manager.joinRoom('rlb-host-peer');
      mockPeerInstance._emit('open', 'guest-peer-id');
      mockConn._emit('open');
      await promise;

      const message: GameMessage = {
        type: 'MARK',
        payload: { cellIndex: 5, player: 'host' },
      };
      manager.send(message);

      expect(mockConn.send).toHaveBeenCalledWith(message);
    });

    it('does not throw when no connection exists', () => {
      const message: GameMessage = { type: 'PING' };
      // Should not throw
      expect(() => manager.send(message)).not.toThrow();
    });
  });

  describe('onMessage handler', () => {
    it('receives messages from the data connection', async () => {
      const mockConn = createMockDataConnection();
      mockPeerInstance.connect.mockReturnValue(mockConn);

      const messageHandler = vi.fn();
      manager.onMessage(messageHandler);

      const promise = manager.joinRoom('rlb-host-peer');
      mockPeerInstance._emit('open', 'guest-peer-id');
      mockConn._emit('open');
      await promise;

      // Simulate receiving a message
      const message: GameMessage = {
        type: 'MARK',
        payload: { cellIndex: 3, player: 'guest' },
      };
      mockConn._emit('data', message);

      expect(messageHandler).toHaveBeenCalledWith(message);
    });

    it('supports multiple message handlers', async () => {
      const mockConn = createMockDataConnection();
      mockPeerInstance.connect.mockReturnValue(mockConn);

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      manager.onMessage(handler1);
      manager.onMessage(handler2);

      const promise = manager.joinRoom('rlb-host-peer');
      mockPeerInstance._emit('open', 'guest-peer-id');
      mockConn._emit('open');
      await promise;

      const message: GameMessage = { type: 'PING' };
      mockConn._emit('data', message);

      expect(handler1).toHaveBeenCalledWith(message);
      expect(handler2).toHaveBeenCalledWith(message);
    });
  });

  describe('onDisconnect handler', () => {
    it('fires when connection closes', async () => {
      const mockConn = createMockDataConnection();
      mockPeerInstance.connect.mockReturnValue(mockConn);

      const disconnectHandler = vi.fn();
      manager.onDisconnect(disconnectHandler);

      const promise = manager.joinRoom('rlb-host-peer');
      mockPeerInstance._emit('open', 'guest-peer-id');
      mockConn._emit('open');
      await promise;

      // Simulate connection close
      mockConn._emit('close');

      expect(disconnectHandler).toHaveBeenCalled();
    });

    it('sets isConnected to false when connection closes', async () => {
      const mockConn = createMockDataConnection();
      mockPeerInstance.connect.mockReturnValue(mockConn);

      const promise = manager.joinRoom('rlb-host-peer');
      mockPeerInstance._emit('open', 'guest-peer-id');
      mockConn._emit('open');
      await promise;

      expect(manager.isConnected()).toBe(true);

      mockConn._emit('close');

      expect(manager.isConnected()).toBe(false);
    });
  });

  describe('Reconnection with exponential backoff', () => {
    it('attempts reconnection after disconnect with exponential backoff delays', async () => {
      const mockConn = createMockDataConnection();
      mockPeerInstance.connect.mockReturnValue(mockConn);

      const promise = manager.joinRoom('rlb-host-peer');
      mockPeerInstance._emit('open', 'guest-peer-id');
      mockConn._emit('open');
      await promise;

      // Simulate disconnect
      mockConn._emit('close');

      // First reconnect attempt after 1s
      expect(mockPeerInstance.connect).toHaveBeenCalledTimes(1); // initial connect only
      vi.advanceTimersByTime(1000);
      expect(mockPeerInstance.connect).toHaveBeenCalledTimes(2); // first retry

      // Simulate the reconnect attempt failing (timeout)
      vi.advanceTimersByTime(15000); // JOIN_ROOM_TIMEOUT
      // Connection closed, attempt incremented

      // Second reconnect attempt after 2s
      vi.advanceTimersByTime(2000);
      expect(mockPeerInstance.connect).toHaveBeenCalledTimes(3); // second retry

      // Simulate the second reconnect attempt failing
      vi.advanceTimersByTime(15000);

      // Third reconnect attempt after 4s
      vi.advanceTimersByTime(4000);
      expect(mockPeerInstance.connect).toHaveBeenCalledTimes(4); // third retry
    });

    it('stops reconnecting after max retries', async () => {
      const mockConn = createMockDataConnection();
      mockPeerInstance.connect.mockReturnValue(mockConn);

      const promise = manager.joinRoom('rlb-host-peer');
      mockPeerInstance._emit('open', 'guest-peer-id');
      mockConn._emit('open');
      await promise;

      // Simulate disconnect
      mockConn._emit('close');

      // Exhaust all 3 retries
      for (let i = 0; i < 3; i++) {
        const delay = [1000, 2000, 4000][i]!;
        vi.advanceTimersByTime(delay);
        vi.advanceTimersByTime(15000); // timeout each attempt
      }

      const callCount = mockPeerInstance.connect.mock.calls.length;

      // No more retries should happen
      vi.advanceTimersByTime(10000);
      expect(mockPeerInstance.connect).toHaveBeenCalledTimes(callCount);
    });

    it('resets reconnect attempts on successful reconnection', async () => {
      const mockConn = createMockDataConnection();
      const reconnConn = createMockDataConnection();

      // First call returns mockConn, subsequent calls return reconnConn
      mockPeerInstance.connect
        .mockReturnValueOnce(mockConn)
        .mockReturnValue(reconnConn);

      const promise = manager.joinRoom('rlb-host-peer');
      mockPeerInstance._emit('open', 'guest-peer-id');
      mockConn._emit('open');
      await promise;

      // Simulate disconnect
      mockConn._emit('close');

      // First reconnect attempt after 1s
      vi.advanceTimersByTime(1000);

      // Simulate successful reconnection
      reconnConn._emit('open');

      expect(manager.isConnected()).toBe(true);
    });
  });

  describe('disconnect()', () => {
    it('cleans up peer and connection', async () => {
      const mockConn = createMockDataConnection();
      mockPeerInstance.connect.mockReturnValue(mockConn);

      const promise = manager.joinRoom('rlb-host-peer');
      mockPeerInstance._emit('open', 'guest-peer-id');
      mockConn._emit('open');
      await promise;

      manager.disconnect();

      expect(mockConn.close).toHaveBeenCalled();
      expect(mockPeerInstance.destroy).toHaveBeenCalled();
      expect(manager.isConnected()).toBe(false);
    });

    it('cancels pending reconnection attempts', async () => {
      const mockConn = createMockDataConnection();
      mockPeerInstance.connect.mockReturnValue(mockConn);

      const promise = manager.joinRoom('rlb-host-peer');
      mockPeerInstance._emit('open', 'guest-peer-id');
      mockConn._emit('open');
      await promise;

      // Simulate disconnect to trigger reconnection
      mockConn._emit('close');

      // Disconnect before reconnection timer fires
      manager.disconnect();

      const callCount = mockPeerInstance.connect.mock.calls.length;

      // Advance past reconnection delay — no new connect calls should happen
      vi.advanceTimersByTime(5000);
      expect(mockPeerInstance.connect).toHaveBeenCalledTimes(callCount);
    });

    it('is safe to call when not connected', () => {
      expect(() => manager.disconnect()).not.toThrow();
    });
  });

  describe('isConnected()', () => {
    it('returns false initially', () => {
      expect(manager.isConnected()).toBe(false);
    });

    it('returns true after successful connection', async () => {
      const mockConn = createMockDataConnection();
      mockPeerInstance.connect.mockReturnValue(mockConn);

      const promise = manager.joinRoom('rlb-host-peer');
      mockPeerInstance._emit('open', 'guest-peer-id');
      mockConn._emit('open');
      await promise;

      expect(manager.isConnected()).toBe(true);
    });
  });
});
