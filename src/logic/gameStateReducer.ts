import type { GameState, GameAction, CellMarks } from '../types';

export const initialGameState: GameState = {
  board: null,
  marks: Array.from({ length: 25 }, () => ({ hostMarked: false, guestMarked: false })),
  myRole: 'host',
  connected: false,
  bingoLines: [],
  seed: '',
  categoryIds: [],
};

export function gameStateReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'MARK_CELL': {
      const { cellIndex, player } = action;
      if (cellIndex < 0 || cellIndex >= 25) return state;

      const markKey = player === 'host' ? 'hostMarked' : 'guestMarked';
      const currentCell = state.marks[cellIndex]!;

      // Idempotent: if already marked by this player, no change
      if (currentCell[markKey]) return state;

      const newMarks: CellMarks[] = state.marks.map((mark, i) =>
        i === cellIndex ? { ...mark, [markKey]: true } : mark
      );

      return { ...state, marks: newMarks };
    }

    case 'UNMARK_CELL': {
      const { cellIndex, player } = action;
      if (cellIndex < 0 || cellIndex >= 25) return state;

      const markKey = player === 'host' ? 'hostMarked' : 'guestMarked';
      const currentCell = state.marks[cellIndex]!;

      // Idempotent: if already unmarked by this player, no change
      if (!currentCell[markKey]) return state;

      const newMarks: CellMarks[] = state.marks.map((mark, i) =>
        i === cellIndex ? { ...mark, [markKey]: false } : mark
      );

      return { ...state, marks: newMarks };
    }

    case 'SET_BOARD': {
      return {
        ...state,
        board: action.board,
        seed: action.board.seed,
        categoryIds: action.board.categoryIds,
      };
    }

    case 'SYNC_STATE': {
      return { ...action.state };
    }

    case 'RESET': {
      return { ...initialGameState };
    }

    default:
      return state;
  }
}
