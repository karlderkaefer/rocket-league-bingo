import type { Board } from '@/lib/board-generator';
import { detectBingoWithWinner, type CellMarks, type BingoLineWithWinner } from '@/lib/bingo-detector';
import type { RoomStatus } from '@/features/rooms/types';

export type PlayerRole = 'host' | 'guest';

export interface GameState {
  board: Board | null;
  marks: CellMarks[]; // 25 entries
  myRole: PlayerRole;
  connected: boolean;
  bingoLines: BingoLineWithWinner[];
  roomId: string;
  seed: string;
  categoryIds: string[];
  isLoading: boolean;
  error: string | null;
  roomStatus: RoomStatus;
}

export type GameAction =
  | { type: 'MARK_CELL'; cellIndex: number; player: PlayerRole }
  | { type: 'UNMARK_CELL'; cellIndex: number; player: PlayerRole }
  | { type: 'SET_BOARD'; board: Board }
  | { type: 'LOAD_MARKS'; marks: CellMarks[] }
  | { type: 'SET_CONNECTED'; connected: boolean }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_ROOM_STATUS'; status: RoomStatus }
  | { type: 'SET_MY_ROLE'; role: PlayerRole }
  | { type: 'RESET' };

/**
 * Creates a fresh initial game state.
 */
export function createInitialState(overrides?: Partial<GameState>): GameState {
  return {
    board: null,
    marks: Array.from({ length: 25 }, () => ({
      hostMarked: false,
      guestMarked: false,
    })),
    myRole: 'host',
    connected: false,
    bingoLines: [],
    roomId: '',
    seed: '',
    categoryIds: [],
    isLoading: false,
    error: null,
    roomStatus: 'active',
    ...overrides,
  };
}

/**
 * Game state reducer handling all game actions.
 *
 * MARK_CELL/UNMARK_CELL: only affects the acting player's mark on a cell.
 * After any mark/unmark change, bingo detection is re-run.
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'MARK_CELL': {
      const { cellIndex, player } = action;
      if (cellIndex < 0 || cellIndex >= state.marks.length) return state;

      const marks = state.marks.map((cell, i) => {
        if (i !== cellIndex) return cell;
        return player === 'host'
          ? { ...cell, hostMarked: true }
          : { ...cell, guestMarked: true };
      });

      return {
        ...state,
        marks,
        bingoLines: detectBingoWithWinner(marks),
      };
    }

    case 'UNMARK_CELL': {
      const { cellIndex, player } = action;
      if (cellIndex < 0 || cellIndex >= state.marks.length) return state;

      const marks = state.marks.map((cell, i) => {
        if (i !== cellIndex) return cell;
        return player === 'host'
          ? { ...cell, hostMarked: false }
          : { ...cell, guestMarked: false };
      });

      return {
        ...state,
        marks,
        bingoLines: detectBingoWithWinner(marks),
      };
    }

    case 'SET_BOARD': {
      return {
        ...state,
        board: action.board,
      };
    }

    case 'LOAD_MARKS': {
      return {
        ...state,
        marks: action.marks,
        bingoLines: detectBingoWithWinner(action.marks),
      };
    }

    case 'SET_CONNECTED': {
      return {
        ...state,
        connected: action.connected,
      };
    }

    case 'SET_LOADING': {
      return {
        ...state,
        isLoading: action.isLoading,
      };
    }

    case 'SET_ERROR': {
      return {
        ...state,
        error: action.error,
      };
    }

    case 'RESET': {
      return createInitialState();
    }

    case 'SET_ROOM_STATUS': {
      return {
        ...state,
        roomStatus: action.status,
      };
    }

    case 'SET_MY_ROLE': {
      return {
        ...state,
        myRole: action.role,
      };
    }

    default:
      return state;
  }
}
