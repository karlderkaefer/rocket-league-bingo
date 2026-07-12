import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { JoinRoomPage } from './JoinRoomPage';

// Mock useRoom hook
const mockJoin = vi.fn();
const mockClearError = vi.fn();
const mockUseRoom = vi.fn(() => ({
  room: null,
  join: mockJoin,
  isLoading: false,
  error: null as string | null,
  clearError: mockClearError,
  isActive: false,
}));

vi.mock('@/features/rooms/hooks/useRoom', () => ({
  useRoom: () => mockUseRoom(),
}));

// Mock useAuthContext
vi.mock('@/app/providers', () => ({
  useAuthContext: () => ({ user: { id: 'test-user-1' } }),
}));

function renderJoinPage(initialRoute = '/join') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/join/:code?" element={<JoinRoomPage />} />
        <Route path="/game/:roomId" element={<div>Game Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('JoinRoomPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRoom.mockReturnValue({
      room: null,
      join: mockJoin,
      isLoading: false,
      error: null,
      clearError: mockClearError,
      isActive: false,
    });
  });

  describe('input validation', () => {
    it('shows error when submitting with empty input', () => {
      renderJoinPage();

      const input = screen.getByLabelText('Share code input');
      // Clear input (it starts empty anyway)
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.submit(screen.getByRole('button', { name: /join room/i }).closest('form')!);

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Please enter a share code.'
      );
      expect(mockJoin).not.toHaveBeenCalled();
    });

    it('shows error when input exceeds 8 characters', () => {
      renderJoinPage();

      const input = screen.getByLabelText('Share code input');
      fireEvent.change(input, { target: { value: 'ABCDEFGHI' } });
      fireEvent.submit(screen.getByRole('button', { name: /join room/i }).closest('form')!);

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Share code must be 8 characters or less.'
      );
      expect(mockJoin).not.toHaveBeenCalled();
    });

    it('shows error when input contains non-alphanumeric characters', () => {
      renderJoinPage();

      const input = screen.getByLabelText('Share code input');
      fireEvent.change(input, { target: { value: 'AB!@#CD' } });
      fireEvent.submit(screen.getByRole('button', { name: /join room/i }).closest('form')!);

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Share code must contain only letters and numbers.'
      );
      expect(mockJoin).not.toHaveBeenCalled();
    });

    it('accepts valid alphanumeric input and calls join', () => {
      renderJoinPage();

      const input = screen.getByLabelText('Share code input');
      fireEvent.change(input, { target: { value: 'ABC123' } });
      fireEvent.submit(screen.getByRole('button', { name: /join room/i }).closest('form')!);

      expect(mockJoin).toHaveBeenCalledWith('ABC123');
    });

    it('trims whitespace before validating', () => {
      renderJoinPage();

      const input = screen.getByLabelText('Share code input');
      fireEvent.change(input, { target: { value: '  ABC123  ' } });
      fireEvent.submit(screen.getByRole('button', { name: /join room/i }).closest('form')!);

      expect(mockJoin).toHaveBeenCalledWith('ABC123');
    });
  });

  describe('error display', () => {
    it('displays server error from useRoom hook', () => {
      mockUseRoom.mockReturnValue({
        room: null,
        join: mockJoin,
        isLoading: false,
        error: 'Invalid share code. Please check and try again.',
        clearError: mockClearError,
        isActive: false,
      });

      renderJoinPage();

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Invalid share code. Please check and try again.'
      );
    });

    it('clears error when user types', () => {
      mockUseRoom.mockReturnValue({
        room: null,
        join: mockJoin,
        isLoading: false,
        error: 'Some error',
        clearError: mockClearError,
        isActive: false,
      });

      renderJoinPage();

      const input = screen.getByLabelText('Share code input');
      fireEvent.change(input, { target: { value: 'A' } });

      expect(mockClearError).toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('shows "Joining..." text and disables input while loading', () => {
      mockUseRoom.mockReturnValue({
        room: null,
        join: mockJoin,
        isLoading: true,
        error: null,
        clearError: mockClearError,
        isActive: false,
      });

      renderJoinPage();

      expect(screen.getByRole('button', { name: /joining/i })).toBeDisabled();
      expect(screen.getByLabelText('Share code input')).toBeDisabled();
    });
  });

  describe('URL code pre-fill', () => {
    it('pre-fills input with code from URL params', () => {
      renderJoinPage('/join/XYZ789');

      expect(screen.getByLabelText('Share code input')).toHaveValue('XYZ789');
    });

    it('auto-joins when valid code is provided in URL', () => {
      renderJoinPage('/join/ABC123');

      expect(mockJoin).toHaveBeenCalledWith('ABC123');
    });
  });
});
