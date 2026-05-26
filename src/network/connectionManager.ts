import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { GameMessage } from '../types';

/**
 * ConnectionManager interface for PeerJS-based peer-to-peer communication.
 */
export interface ConnectionManager {
  createRoom(): Promise<{ peerId: string }>;
  joinRoom(peerId: string): Promise<void>;
  send(message: GameMessage): void;
  onMessage(handler: (msg: GameMessage) => void): void;
  onDisconnect(handler: () => void): void;
  onConnect(handler: () => void): void;
  disconnect(): void;
  isConnected(): boolean;
}

/** Error thrown when the room is full (host rejects connection). */
export class RoomFullError extends Error {
  constructor() {
    super('This room already has a player.');
    this.name = 'RoomFullError';
  }
}

/** Error thrown when the peer is unreachable. */
export class PeerUnavailableError extends Error {
  constructor() {
    super('Host is unreachable. They may have closed the room.');
    this.name = 'PeerUnavailableError';
  }
}

/** Error thrown when connection times out. */
export class ConnectionTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectionTimeoutError';
  }
}

/** Reconnection configuration */
const RECONNECT_DELAYS = [1000, 2000, 4000]; // exponential backoff: 1s, 2s, 4s
const MAX_RETRIES = 3;
const CREATE_ROOM_TIMEOUT = 10000; // 10 seconds
const JOIN_ROOM_TIMEOUT = 15000; // 15 seconds

/** PeerJS configuration with ICE servers for NAT traversal */
const PEER_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ],
  },
};

/**
 * PeerJS-based connection manager for real-time peer-to-peer communication.
 * Handles room creation (host), room joining (guest), message passing,
 * error handling, and reconnection with exponential backoff.
 */
export class PeerConnectionManager implements ConnectionManager {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private remotePeerId: string | null = null;
  private connected = false;
  private reconnecting = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private messageHandlers: Array<(msg: GameMessage) => void> = [];
  private disconnectHandlers: Array<() => void> = [];
  private connectHandlers: Array<() => void> = [];

  private seedBase62: string;

  constructor(seedBase62: string) {
    this.seedBase62 = seedBase62;
  }

  /**
   * Create a room as the host. Registers a PeerJS peer with a deterministic ID
   * derived from the seed and waits for the signaling server to confirm.
   * Times out after 10 seconds.
   */
  async createRoom(): Promise<{ peerId: string }> {
    const peerId = `rlb-${this.seedBase62}`;

    return new Promise<{ peerId: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.peer) {
          this.peer.destroy();
          this.peer = null;
        }
        reject(
          new ConnectionTimeoutError(
            'Could not connect to signaling server. Check your internet connection.'
          )
        );
      }, CREATE_ROOM_TIMEOUT);

      this.peer = new Peer(peerId, PEER_CONFIG);

      this.peer.on('open', (id) => {
        clearTimeout(timeout);
        this.setupHostListeners();
        resolve({ peerId: id });
      });

      this.peer.on('error', (error) => {
        clearTimeout(timeout);
        this.handlePeerError(error, reject);
      });
    });
  }

  /**
   * Join a room as a guest. Connects to the host's peer ID.
   * Times out after 15 seconds.
   * Throws RoomFullError if the host rejects the connection.
   */
  async joinRoom(peerId: string): Promise<void> {
    this.remotePeerId = peerId;

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.peer) {
          this.peer.destroy();
          this.peer = null;
        }
        reject(
          new ConnectionTimeoutError(
            'Host is unreachable. They may have closed the room.'
          )
        );
      }, JOIN_ROOM_TIMEOUT);

      // Generate a random guest peer ID to avoid PeerJS auto-generation issues
      const guestId = `rlb-guest-${Math.random().toString(36).substring(2, 10)}`;
      this.peer = new Peer(guestId, PEER_CONFIG);

      this.peer.on('open', () => {
        if (!this.peer) {
          clearTimeout(timeout);
          reject(new Error('Peer destroyed before connection could be made.'));
          return;
        }

        const conn = this.peer.connect(peerId, { reliable: true });
        this.setupGuestConnection(conn, timeout, resolve, reject);
      });

      this.peer.on('error', (error) => {
        clearTimeout(timeout);
        this.handlePeerError(error, reject);
      });
    });
  }

  /**
   * Send a message to the connected peer via the DataChannel.
   */
  send(message: GameMessage): void {
    if (this.connection && this.connection.open) {
      this.connection.send(message);
    }
  }

  /**
   * Register a handler for incoming messages.
   */
  onMessage(handler: (msg: GameMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Register a handler for connection events.
   */
  onConnect(handler: () => void): void {
    this.connectHandlers.push(handler);
  }

  /**
   * Register a handler for disconnection events.
   */
  onDisconnect(handler: () => void): void {
    this.disconnectHandlers.push(handler);
  }

  /**
   * Disconnect from the peer and clean up all resources.
   */
  disconnect(): void {
    this.cancelReconnect();
    this.connected = false;

    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }

  /**
   * Returns whether the DataChannel is currently connected.
   */
  isConnected(): boolean {
    return this.connected;
  }

  // --- Private methods ---

  /**
   * Set up listeners for the host to accept incoming guest connections.
   */
  private setupHostListeners(): void {
    if (!this.peer) return;

    this.peer.on('connection', (conn: DataConnection) => {
      // If we already have a connection, reject the new one (room full)
      if (this.connection && this.connection.open) {
        conn.on('open', () => {
          conn.send({ type: 'REJECT', reason: 'room-full' } as GameMessage);
          setTimeout(() => conn.close(), 100);
        });
        return;
      }

      conn.on('open', () => {
        this.connection = conn;
        this.remotePeerId = conn.peer;
        this.connected = true;
        this.reconnectAttempt = 0;
        this.setupDataHandlers(conn);
        this.emitConnect();
      });
    });

    this.peer.on('disconnected', () => {
      // Peer disconnected from signaling server — try to reconnect
      if (this.peer && !this.peer.destroyed) {
        this.peer.reconnect();
      }
    });
  }

  /**
   * Set up the guest's connection to the host.
   */
  private setupGuestConnection(
    conn: DataConnection,
    timeout: ReturnType<typeof setTimeout>,
    resolve: () => void,
    reject: (reason: Error) => void
  ): void {
    conn.on('open', () => {
      clearTimeout(timeout);
      this.connection = conn;
      this.connected = true;
      this.reconnectAttempt = 0;
      this.setupDataHandlers(conn);
      this.emitConnect();
      resolve();
    });

    conn.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Connection error: ${err}`));
    });
  }

  /**
   * Set up data and close handlers on an established DataConnection.
   */
  private setupDataHandlers(conn: DataConnection): void {
    conn.on('data', (data) => {
      const message = data as GameMessage;

      // Handle room-full rejection (guest side)
      if (message.type === 'REJECT' && message.reason === 'room-full') {
        this.connected = false;
        conn.close();
        // Emit a special error — consumers should handle this
        return;
      }

      this.emitMessage(message);
    });

    conn.on('close', () => {
      this.connected = false;
      this.connection = null;
      this.emitDisconnect();
      this.attemptReconnect();
    });
  }

  /**
   * Handle PeerJS errors by type.
   */
  private handlePeerError(
    error: { type: string; message?: string },
    reject?: (reason: Error) => void
  ): void {
    switch (error.type) {
      case 'peer-unavailable':
        if (reject) {
          reject(new PeerUnavailableError());
        }
        break;
      case 'server-error':
      case 'socket-error':
        if (reject) {
          reject(
            new ConnectionTimeoutError(
              'Could not connect to signaling server. Check your internet connection.'
            )
          );
        }
        break;
      case 'network':
        if (reject) {
          reject(new Error('Network error. Check your internet connection.'));
        }
        break;
      default:
        if (reject) {
          reject(new Error(error.message || `PeerJS error: ${error.type}`));
        }
        break;
    }
  }

  /**
   * Attempt reconnection with exponential backoff (1s, 2s, 4s), up to 3 retries.
   */
  private attemptReconnect(): void {
    if (this.reconnecting || !this.remotePeerId || !this.peer) return;
    if (this.reconnectAttempt >= MAX_RETRIES) return;

    this.reconnecting = true;
    const delay = RECONNECT_DELAYS[this.reconnectAttempt] ?? RECONNECT_DELAYS[RECONNECT_DELAYS.length - 1];

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;

      if (!this.peer || this.peer.destroyed) {
        this.reconnecting = false;
        return;
      }

      // If peer is disconnected from signaling, reconnect first
      if (this.peer.disconnected) {
        this.peer.reconnect();
      }

      const conn = this.peer.connect(this.remotePeerId!, { reliable: true });

      const reconnectTimeout = setTimeout(() => {
        // This attempt failed
        this.reconnecting = false;
        this.reconnectAttempt++;
        conn.close();
        this.attemptReconnect();
      }, JOIN_ROOM_TIMEOUT);

      conn.on('open', () => {
        clearTimeout(reconnectTimeout);
        this.connection = conn;
        this.connected = true;
        this.reconnecting = false;
        this.reconnectAttempt = 0;
        this.setupDataHandlers(conn);
        this.emitConnect();

        // Send SYNC_REQUEST on successful reconnection
        this.send({ type: 'SYNC_REQUEST' });
      });

      conn.on('error', () => {
        clearTimeout(reconnectTimeout);
        this.reconnecting = false;
        this.reconnectAttempt++;
        this.attemptReconnect();
      });
    }, delay);
  }

  /**
   * Cancel any pending reconnection attempt.
   */
  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnecting = false;
    this.reconnectAttempt = 0;
  }

  // --- Event emitters ---

  private emitMessage(msg: GameMessage): void {
    for (const handler of this.messageHandlers) {
      handler(msg);
    }
  }

  private emitConnect(): void {
    for (const handler of this.connectHandlers) {
      handler();
    }
  }

  private emitDisconnect(): void {
    for (const handler of this.disconnectHandlers) {
      handler();
    }
  }
}

/**
 * Factory function to create a ConnectionManager instance.
 */
export function createConnectionManager(seedBase62: string): ConnectionManager {
  return new PeerConnectionManager(seedBase62);
}
