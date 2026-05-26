/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useEffect,
  useState,
} from 'react';
import type { GameState, GameMessage, CellMarks } from '../types';
import { gameStateReducer, initialGameState } from '../logic/gameStateReducer';
import { detectBingo } from '../logic/bingoDetector';
import { saveGameState, loadGameState, clearGameState } from '../logic/persistenceAdapter';
import { generateBoard } from '../logic/boardGenerator';
import {
  encodeShareCode,
  decodeShareCode,
} from '../logic/shareCodeCodec';
import { createConnectionManager, type ConnectionManager } from '../network/connectionManager';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface GameContextValue {
  state: GameState;
  markCell: (cellIndex: number) => void;
  unmarkCell: (cellIndex: number) => void;
  createRoom: (seed: string, categoryIds: string[]) => Promise<string>;
  joinRoom: (shareCode: string) => Promise<void>;
  resetGame: () => void;
  connectionStatus: ConnectionStatus;
}

const GameContext = createContext<GameContextValue | null>(null);

/**
 * Hook to access the GameContext. Throws if used outside GameProvider.
 */
export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return ctx;
}

interface GameProviderProps {
  children: React.ReactNode;
}

/**
 * GameProvider wraps the application with game state management.
 * Integrates useReducer, connectionManager, persistenceAdapter, and bingoDetector.
 */
export function GameProvider({ children }: GameProviderProps) {
  const [state, dispatch] = useReducer(gameStateReducer, initialGameState);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  const connectionRef = useRef<ConnectionManager | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remotePeerIdRef = useRef<string>('');
  const localPeerIdRef = useRef<string>('');

  // --- Bingo detection: update bingoLines whenever marks change ---
  const stateWithBingo = React.useMemo(() => {
    const bingoLines = detectBingo(state.marks);
    // Only create a new object if bingoLines actually changed
    if (
      bingoLines.length === state.bingoLines.length &&
      bingoLines.every(
        (line, i) =>
          line.type === state.bingoLines[i]?.type &&
          line.index === state.bingoLines[i]?.index
      )
    ) {
      return state;
    }
    return { ...state, bingoLines };
  }, [state]);

  // --- Debounced persistence: save state within 1 second of changes ---
  useEffect(() => {
    // Don't persist if there's no board (game hasn't started)
    if (!stateWithBingo.board) return;

    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = setTimeout(() => {
      saveGameState({
        seed: stateWithBingo.seed,
        categoryIds: stateWithBingo.categoryIds,
        marks: stateWithBingo.marks,
        myRole: stateWithBingo.myRole,
        peerId: localPeerIdRef.current,
        remotePeerId: remotePeerIdRef.current,
        timestamp: Date.now(),
      });
    }, 1000);

    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, [stateWithBingo]);

  // --- On page load: restore state from localStorage and attempt reconnection ---
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const persisted = loadGameState();
    if (!persisted) return;

    // Regenerate board from persisted seed + categories
    const board = generateBoard({
      seed: persisted.seed,
      categoryIds: persisted.categoryIds,
    });

    // Restore full game state
    dispatch({
      type: 'SYNC_STATE',
      state: {
        board,
        marks: persisted.marks,
        myRole: persisted.myRole,
        connected: false,
        bingoLines: [],
        seed: persisted.seed,
        categoryIds: persisted.categoryIds,
      },
    });

    // Store peer info for persistence
    localPeerIdRef.current = persisted.peerId;
    remotePeerIdRef.current = persisted.remotePeerId;

    // Attempt reconnection if we have a remote peer ID
    if (persisted.remotePeerId) {
      setConnectionStatus('reconnecting');

      const manager = createConnectionManager(persisted.seed);
      connectionRef.current = manager;

      manager.onMessage((msg: GameMessage) => {
        // Handle messages during reconnection
        if (msg.type === 'MARK') {
          dispatch({
            type: 'MARK_CELL',
            cellIndex: msg.payload.cellIndex,
            player: msg.payload.player,
          });
        } else if (msg.type === 'UNMARK') {
          dispatch({
            type: 'UNMARK_CELL',
            cellIndex: msg.payload.cellIndex,
            player: msg.payload.player,
          });
        } else if (msg.type === 'SYNC_RESPONSE') {
          // Merge remote marks into local state
          dispatch({
            type: 'SYNC_STATE',
            state: {
              board,
              marks: persisted.marks.map((local, i) => {
                const remote = msg.payload.marks[i];
                if (!remote) return local;
                return {
                  hostMarked: local.hostMarked || remote.hostMarked,
                  guestMarked: local.guestMarked || remote.guestMarked,
                };
              }),
              myRole: persisted.myRole,
              connected: true,
              bingoLines: [],
              seed: persisted.seed,
              categoryIds: persisted.categoryIds,
            },
          });
        }
      });

      manager.onConnect(() => {
        setConnectionStatus('connected');
        // Request sync from the other peer
        manager.send({ type: 'SYNC_REQUEST' });
      });

      manager.onDisconnect(() => {
        setConnectionStatus('reconnecting');
      });

      // Attempt to join the remote peer (connectionManager handles 3 retries with exponential backoff)
      manager.joinRoom(persisted.remotePeerId).catch(() => {
        // Reconnection failed after retries — continue with local state (game is still playable offline)
        setConnectionStatus('disconnected');
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Handle incoming messages from the connection ---
  const handleMessage = useCallback(
    (msg: GameMessage) => {
      switch (msg.type) {
        case 'MARK': {
          dispatch({
            type: 'MARK_CELL',
            cellIndex: msg.payload.cellIndex,
            player: msg.payload.player,
          });
          break;
        }
        case 'UNMARK': {
          dispatch({
            type: 'UNMARK_CELL',
            cellIndex: msg.payload.cellIndex,
            player: msg.payload.player,
          });
          break;
        }
        case 'SYNC_REQUEST': {
          // Respond with current marks
          connectionRef.current?.send({
            type: 'SYNC_RESPONSE',
            payload: { marks: state.marks },
          });
          break;
        }
        case 'SYNC_RESPONSE': {
          // Merge remote marks into local state
          const mergedMarks: CellMarks[] = state.marks.map((local, i) => {
            const remote = msg.payload.marks[i];
            if (!remote) return local;
            return {
              hostMarked: local.hostMarked || remote.hostMarked,
              guestMarked: local.guestMarked || remote.guestMarked,
            };
          });
          dispatch({
            type: 'SYNC_STATE',
            state: { ...state, marks: mergedMarks },
          });
          break;
        }
        case 'INIT': {
          // Guest side: generate board from seed + categories
          const board = generateBoard({
            seed: msg.payload.seed,
            categoryIds: msg.payload.categoryIds,
          });
          dispatch({ type: 'SET_BOARD', board });
          break;
        }
        default:
          // Ignore PING, PONG, REJECT, and unknown messages
          break;
      }
    },
    [state]
  );

  // --- Set up connection event handlers ---
  const setupConnectionHandlers = useCallback(
    (manager: ConnectionManager) => {
      manager.onMessage(handleMessage);
      manager.onConnect(() => {
        setConnectionStatus('connected');
      });
      manager.onDisconnect(() => {
        setConnectionStatus('reconnecting');
      });
    },
    [handleMessage]
  );

  // --- Actions ---

  const markCell = useCallback(
    (cellIndex: number) => {
      const player = state.myRole;
      dispatch({ type: 'MARK_CELL', cellIndex, player });
      // Send to remote peer
      connectionRef.current?.send({
        type: 'MARK',
        payload: { cellIndex, player },
      });
    },
    [state.myRole]
  );

  const unmarkCell = useCallback(
    (cellIndex: number) => {
      const player = state.myRole;
      dispatch({ type: 'UNMARK_CELL', cellIndex, player });
      // Send to remote peer
      connectionRef.current?.send({
        type: 'UNMARK',
        payload: { cellIndex, player },
      });
    },
    [state.myRole]
  );

  const createRoom = useCallback(
    async (seed: string, categoryIds: string[]): Promise<string> => {
      // Clear previously persisted state (new game session)
      clearGameState();

      // Clean up any existing connection
      if (connectionRef.current) {
        connectionRef.current.disconnect();
      }

      setConnectionStatus('connecting');

      // Create connection manager with the seed
      const manager = createConnectionManager(seed);
      connectionRef.current = manager;

      // Set up handlers
      setupConnectionHandlers(manager);

      // Create the room (registers peer with signaling server)
      const { peerId } = await manager.createRoom();
      localPeerIdRef.current = peerId;

      // Generate the board locally
      const board = generateBoard({ seed, categoryIds });
      dispatch({ type: 'SET_BOARD', board });

      // Set role to host
      dispatch({
        type: 'SYNC_STATE',
        state: {
          ...initialGameState,
          board,
          seed,
          categoryIds,
          myRole: 'host',
          connected: false,
          marks: initialGameState.marks,
          bingoLines: [],
        },
      });

      // Override onConnect to send INIT to guest when they connect
      manager.onConnect(() => {
        setConnectionStatus('connected');
        manager.send({
          type: 'INIT',
          payload: { seed, categoryIds },
        });
      });

      // Generate share code
      const shareCode = encodeShareCode({
        peerId,
        seed,
        categoryIds,
      });

      return shareCode;
    },
    [setupConnectionHandlers]
  );

  const joinRoom = useCallback(
    async (shareCode: string): Promise<void> => {
      const decoded = decodeShareCode(shareCode);
      if (!decoded) {
        throw new Error('Invalid share code. Please check and try again.');
      }

      // Clear previously persisted state (new game session)
      clearGameState();

      // Clean up any existing connection
      if (connectionRef.current) {
        connectionRef.current.disconnect();
      }

      setConnectionStatus('connecting');

      // Create connection manager with the seed
      const manager = createConnectionManager(decoded.seed);
      connectionRef.current = manager;
      remotePeerIdRef.current = decoded.peerId;

      // Set role to guest
      dispatch({
        type: 'SYNC_STATE',
        state: {
          ...initialGameState,
          myRole: 'guest',
          seed: decoded.seed,
          categoryIds: decoded.categoryIds,
          connected: false,
          marks: initialGameState.marks,
          bingoLines: [],
          board: null,
        },
      });

      // Set up message handler for INIT
      manager.onMessage((msg: GameMessage) => {
        handleMessage(msg);
      });

      manager.onConnect(() => {
        setConnectionStatus('connected');
      });

      manager.onDisconnect(() => {
        setConnectionStatus('reconnecting');
      });

      // Join the room (connect to host's peer ID)
      await manager.joinRoom(decoded.peerId);
      localPeerIdRef.current = decoded.peerId; // Guest's local peer is auto-generated by PeerJS
    },
    [handleMessage]
  );

  const resetGame = useCallback(() => {
    // Disconnect from peer
    if (connectionRef.current) {
      connectionRef.current.disconnect();
      connectionRef.current = null;
    }

    // Clear persisted state
    clearGameState();

    // Reset state
    dispatch({ type: 'RESET' });
    setConnectionStatus('disconnected');
    remotePeerIdRef.current = '';
    localPeerIdRef.current = '';
  }, []);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      if (connectionRef.current) {
        connectionRef.current.disconnect();
      }
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, []);

  const contextValue: GameContextValue = {
    state: stateWithBingo,
    markCell,
    unmarkCell,
    createRoom,
    joinRoom,
    resetGame,
    connectionStatus,
  };

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
}

export default GameContext;
