import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

const AUTH_TIMEOUT_MS = 10_000;

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
}

interface UseAuthReturn extends AuthState {
  retry: () => void;
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    error: null,
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const clearAuthTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const initAuth = useCallback(async () => {
    if (!mountedRef.current) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    // Check for OAuth error in URL query params (e.g. after failed GitHub sign-in)
    const urlParams = new URLSearchParams(window.location.search);
    const oauthError = urlParams.get('error_description') || urlParams.get('error');
    const oauthErrorCode = urlParams.get('error_code');
    if (oauthError) {
      // Clean the URL so the error doesn't persist on refresh
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);

      // If the error is "identity_already_exists", auto-retry with signInWithOAuth
      // This happens when linkIdentity fails because the GitHub account is already
      // linked to a different user. Fall back to signing into that existing account.
      if (oauthErrorCode === 'identity_already_exists') {
        await supabase.auth.signInWithOAuth({
          provider: 'github',
          options: { redirectTo: window.location.origin },
        });
        return; // Will redirect, no need to continue
      }
    }

    // Start timeout
    timeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Authentication timed out. Please check your connection and try again.',
        }));
      }
    }, AUTH_TIMEOUT_MS);

    try {
      // Check for existing session
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!mountedRef.current) return;

      if (sessionError) {
        throw sessionError;
      }

      if (session) {
        clearAuthTimeout();
        setState({
          user: session.user,
          session,
          isLoading: false,
          error: oauthError ? decodeURIComponent(oauthError.replace(/\+/g, ' ')) : null,
        });
        return;
      }

      // No existing session — sign in anonymously
      const { data, error: signInError } = await supabase.auth.signInAnonymously();

      if (!mountedRef.current) return;

      if (signInError) {
        throw signInError;
      }

      clearAuthTimeout();
      setState({
        user: data.session?.user ?? null,
        session: data.session,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      clearAuthTimeout();
      if (!mountedRef.current) return;

      const message =
        err instanceof Error || isAuthError(err)
          ? err.message
          : 'Unable to connect. Check your internet and try again.';

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  }, [clearAuthTimeout]);

  useEffect(() => {
    mountedRef.current = true;

    void initAuth();

    // Listen for auth state changes (e.g. token refresh, sign out)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        user: session?.user ?? null,
        session,
      }));
    });

    return () => {
      mountedRef.current = false;
      clearAuthTimeout();
      subscription.unsubscribe();
    };
  }, [initAuth, clearAuthTimeout]);

  const retry = useCallback(() => {
    void initAuth();
  }, [initAuth]);

  return {
    ...state,
    retry,
  };
}

function isAuthError(err: unknown): err is AuthError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    'status' in err
  );
}
