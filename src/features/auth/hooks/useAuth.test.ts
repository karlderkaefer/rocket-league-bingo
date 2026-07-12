import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAuth } from './useAuth';

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInAnonymously: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

// Import the mocked module to control return values
import { supabase } from '@/lib/supabase/client';

const mockGetSession = supabase.auth.getSession as Mock;
const mockSignInAnonymously = supabase.auth.signInAnonymously as Mock;

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls signInAnonymously when getSession returns no session', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockSignInAnonymously.mockResolvedValue({
      data: { session: { user: { id: 'anon-123' }, access_token: 'tok' } },
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetSession).toHaveBeenCalledOnce();
    expect(mockSignInAnonymously).toHaveBeenCalledOnce();
    expect(result.current.user).toEqual({ id: 'anon-123' });
    expect(result.current.error).toBeNull();
  });

  it('reuses existing session without calling signInAnonymously', async () => {
    const existingSession = {
      user: { id: 'existing-user-456' },
      access_token: 'existing-token',
    };
    mockGetSession.mockResolvedValue({
      data: { session: existingSession },
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetSession).toHaveBeenCalledOnce();
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
    expect(result.current.user).toEqual({ id: 'existing-user-456' });
    expect(result.current.session).toBe(existingSession);
    expect(result.current.error).toBeNull();
  });

  it('sets error state when signInAnonymously fails', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockSignInAnonymously.mockResolvedValue({
      data: { session: null },
      error: { message: 'Auth service unavailable', status: 503 },
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Auth service unavailable');
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  it('retry mechanism re-runs initAuth after failure', async () => {
    // First call: getSession returns null, signIn fails
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    mockSignInAnonymously.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Network error', status: 500 },
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');

    // Setup for retry: this time it succeeds
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    mockSignInAnonymously.mockResolvedValueOnce({
      data: { session: { user: { id: 'retry-user' }, access_token: 'tok2' } },
      error: null,
    });

    // Call retry
    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.user).toEqual({ id: 'retry-user' });
    expect(mockGetSession).toHaveBeenCalledTimes(2);
    expect(mockSignInAnonymously).toHaveBeenCalledTimes(2);
  });
});
