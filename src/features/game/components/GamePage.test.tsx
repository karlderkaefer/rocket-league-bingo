import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GamePage } from './GamePage';
import type { GameState } from '@/features/game/reducer';
import type { Board, Cell } from '@/lib/board-generator';
import type { CellMarks, BingoLine } from '@/lib/bingo-detector';

// --- Mock data helpers ---

function makeCells(count = 25): Cell[] {
  return Array.from({ length: count }, (_, i) => ({
    text: `Cell ${i}`,
    categoryId: 'test-cat',
    index: i,
  }));
}

function makeMarks(count = 25): CellMarks[] {
  return Array.from({ length: count }, () => ({
    hostMarked: false,
    guestMarked: false,
  }));
}

function makeBoard(): Board {
  return {
    cells: makeCells(),
    seed: 'test-seed-123',
    categoryIds: ['cat1', 'cat2'],
    boardSize: 5,
  };
}

function makeDefaultState(overrides?: Partial<GameState>): GameState {
  return {
    board: makeBoard(),
    marks: makeMarks(),
    myRole: 'host',
    connected: true,
    bingoLines: [],
    roomId: 'room-1',
    seed: 'test-seed-123',
    categoryIds: ['cat1', 'cat2'],
    isLoading: false,
    error: null,
    roomStatus: 'active',
    ...overrides,
  };
}

// --- Mocks ---

const mockMarkCell = vi.fn();
const mockUnmarkCell = vi.fn();
const mockEndGame = vi.fn();
const mockRetryConnection = vi.fn();
const mockRetryFailedMarks = vi.fn();

const mockUseGameState = vi.fn(() => ({
  state: makeDefaultState(),
  markCell: mockMarkCell,
  unmarkCell: mockUnmarkCell,
  endGame: mockEndGame,
  isLoading: false,
  error: null as string | null,
  connectionState: 'connected' as 'connecting' | 'connected' | 'disconnected' | 'error',
  isConnected: true,
  retryConnection: mockRetryConnection,
  cellErrors: new Set<number>(),
  retryFailedMarks: mockRetryFailedMarks,
}));

const mockUseBingo = vi.fn(() => ({
  bingoLines: [] as BingoLine[],
  hasBingo: false,
}));

vi.mock('@/features/game/hooks/useGameState', () => ({
  useGameState: () => mockUseGameState(),
}));

vi.mock('@/features/game/hooks/useBingo', () => ({
  useBingo: () => mockUseBingo(),
}));

// GamePage's header renders PlayerPresence and UserMenu, which read the auth
// context via useAuthContext. Mock it so the component tree renders without a
// real AuthProvider (matches the pattern used in JoinRoomPage.test.tsx).
vi.mock('@/app/providers', () => ({
  useAuthContext: () => ({
    user: null,
    session: null,
    isLoading: false,
    error: null,
    retry: vi.fn(),
  }),
}));

// --- Render helper ---

function renderGamePage(roomId = 'room-1') {
  return render(
    <MemoryRouter initialEntries={[`/game/${roomId}`]}>
      <Routes>
        <Route path="/game/:roomId" element={<GamePage />} />
        <Route path="/create" element={<div>Create Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// --- Tests ---

describe('GamePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGameState.mockReturnValue({
      state: makeDefaultState(),
      markCell: mockMarkCell,
      unmarkCell: mockUnmarkCell,
      endGame: mockEndGame,
      isLoading: false,
      error: null,
      connectionState: 'connected' as const,
      isConnected: true,
      retryConnection: mockRetryConnection,
      cellErrors: new Set<number>(),
      retryFailedMarks: mockRetryFailedMarks,
    });
    mockUseBingo.mockReturnValue({ bingoLines: [], hasBingo: false });
  });

  describe('loading state', () => {
    it('shows loading spinner when isLoading is true', () => {
      mockUseGameState.mockReturnValue({
        state: makeDefaultState({ board: null }),
        markCell: mockMarkCell,
        unmarkCell: mockUnmarkCell,
        endGame: mockEndGame,
        isLoading: true,
        error: null,
        connectionState: 'connecting' as const,
        isConnected: false,
        retryConnection: mockRetryConnection,
        cellErrors: new Set<number>(),
        retryFailedMarks: mockRetryFailedMarks,
      });

      renderGamePage();

      expect(screen.getByRole('status', { name: /loading game/i })).toBeInTheDocument();
      expect(screen.getByText('Loading game…')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message and retry button when error exists and no board', () => {
      mockUseGameState.mockReturnValue({
        state: makeDefaultState({ board: null }),
        markCell: mockMarkCell,
        unmarkCell: mockUnmarkCell,
        endGame: mockEndGame,
        isLoading: false,
        error: 'Could not load game state.',
        connectionState: 'error' as const,
        isConnected: false,
        retryConnection: mockRetryConnection,
        cellErrors: new Set<number>(),
        retryFailedMarks: mockRetryFailedMarks,
      });

      renderGamePage();

      expect(screen.getByText('Could not load game state.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  describe('board rendering', () => {
    it('renders BoardGrid when board is loaded (25 cells visible)', () => {
      renderGamePage();

      const grid = screen.getByRole('grid', { name: /bingo board/i });
      expect(grid).toBeInTheDocument();

      const buttons = screen.getAllByRole('button');
      // 25 cells + End Game button = 26
      expect(buttons.length).toBeGreaterThanOrEqual(25);
    });
  });

  describe('End Game button', () => {
    it('shows "End Game" button only for host role when room is active', () => {
      renderGamePage();

      expect(screen.getByRole('button', { name: /end game/i })).toBeInTheDocument();
    });

    it('hides "End Game" button for guest role', () => {
      mockUseGameState.mockReturnValue({
        state: makeDefaultState({ myRole: 'guest' }),
        markCell: mockMarkCell,
        unmarkCell: mockUnmarkCell,
        endGame: mockEndGame,
        isLoading: false,
        error: null,
        connectionState: 'connected' as const,
        isConnected: true,
        retryConnection: mockRetryConnection,
        cellErrors: new Set<number>(),
        retryFailedMarks: mockRetryFailedMarks,
      });

      renderGamePage();

      expect(screen.queryByRole('button', { name: /end game/i })).not.toBeInTheDocument();
    });

    it('hides "End Game" button when room is completed', () => {
      mockUseGameState.mockReturnValue({
        state: makeDefaultState({ roomStatus: 'completed' }),
        markCell: mockMarkCell,
        unmarkCell: mockUnmarkCell,
        endGame: mockEndGame,
        isLoading: false,
        error: null,
        connectionState: 'connected' as const,
        isConnected: true,
        retryConnection: mockRetryConnection,
        cellErrors: new Set<number>(),
        retryFailedMarks: mockRetryFailedMarks,
      });

      renderGamePage();

      expect(screen.queryByRole('button', { name: /end game/i })).not.toBeInTheDocument();
    });

    it('calls endGame when "End Game" button is clicked', async () => {
      const user = userEvent.setup();
      renderGamePage();

      await user.click(screen.getByRole('button', { name: /end game/i }));
      expect(mockEndGame).toHaveBeenCalledTimes(1);
    });
  });

  describe('Game Over state', () => {
    it('shows "Game Over" message when roomStatus is completed', () => {
      mockUseGameState.mockReturnValue({
        state: makeDefaultState({ roomStatus: 'completed' }),
        markCell: mockMarkCell,
        unmarkCell: mockUnmarkCell,
        endGame: mockEndGame,
        isLoading: false,
        error: null,
        connectionState: 'connected' as const,
        isConnected: true,
        retryConnection: mockRetryConnection,
        cellErrors: new Set<number>(),
        retryFailedMarks: mockRetryFailedMarks,
      });

      renderGamePage();

      expect(screen.getByText('Game Over')).toBeInTheDocument();
      expect(screen.getByText('This game has ended.')).toBeInTheDocument();
    });

    it('shows "Game Over" with expiry text when roomStatus is expired', () => {
      mockUseGameState.mockReturnValue({
        state: makeDefaultState({ roomStatus: 'expired' }),
        markCell: mockMarkCell,
        unmarkCell: mockUnmarkCell,
        endGame: mockEndGame,
        isLoading: false,
        error: null,
        connectionState: 'connected' as const,
        isConnected: true,
        retryConnection: mockRetryConnection,
        cellErrors: new Set<number>(),
        retryFailedMarks: mockRetryFailedMarks,
      });

      renderGamePage();

      expect(screen.getByText('Game Over')).toBeInTheDocument();
      expect(
        screen.getByText('This game has expired due to inactivity.'),
      ).toBeInTheDocument();
    });

    it('shows "Create New Room" link in game-over state', () => {
      mockUseGameState.mockReturnValue({
        state: makeDefaultState({ roomStatus: 'completed' }),
        markCell: mockMarkCell,
        unmarkCell: mockUnmarkCell,
        endGame: mockEndGame,
        isLoading: false,
        error: null,
        connectionState: 'connected' as const,
        isConnected: true,
        retryConnection: mockRetryConnection,
        cellErrors: new Set<number>(),
        retryFailedMarks: mockRetryFailedMarks,
      });

      renderGamePage();

      const link = screen.getByRole('link', { name: /create new room/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/create');
    });

    it('board is disabled (read-only) when game is over', async () => {
      const user = userEvent.setup();
      mockUseGameState.mockReturnValue({
        state: makeDefaultState({ roomStatus: 'completed' }),
        markCell: mockMarkCell,
        unmarkCell: mockUnmarkCell,
        endGame: mockEndGame,
        isLoading: false,
        error: null,
        connectionState: 'connected' as const,
        isConnected: true,
        retryConnection: mockRetryConnection,
        cellErrors: new Set<number>(),
        retryFailedMarks: mockRetryFailedMarks,
      });

      renderGamePage();

      // Board renders as grid with gridcells (not buttons) when disabled
      const grid = screen.getByRole('grid', { name: /bingo board/i });
      expect(grid).toBeInTheDocument();

      // Cells are gridcells, not buttons — indicating read-only
      const cells = screen.getAllByRole('gridcell');
      expect(cells).toHaveLength(25);

      // Click a cell — markCell should NOT be called because the grid is read-only
      if (cells[0]) {
        await user.click(cells[0]);
      }
      expect(mockMarkCell).not.toHaveBeenCalled();
      expect(mockUnmarkCell).not.toHaveBeenCalled();
    });
  });

  describe('Bingo notification', () => {
    it('shows BingoNotification when bingo lines exist', () => {
      mockUseBingo.mockReturnValue({
        bingoLines: [{ type: 'row', index: 0 }],
        hasBingo: true,
      });

      renderGamePage();

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/BINGO!/)).toBeInTheDocument();
    });

    it('does not show BingoNotification when no bingo lines', () => {
      mockUseBingo.mockReturnValue({
        bingoLines: [],
        hasBingo: false,
      });

      renderGamePage();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
