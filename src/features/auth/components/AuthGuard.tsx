import { useState, type ReactNode } from 'react';
import { useAuthContext } from '@/app/providers';
import { supabase } from '@/lib/supabase/client';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isLoading, error, user, retry } = useAuthContext();

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Authenticating">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Connecting...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return <SignInFallback error={error} onRetry={retry} />;
  }

  return <>{children}</>;
}

interface SignInFallbackProps {
  error: string | null;
  onRetry: () => void;
}

function SignInFallback({ error, onRetry }: SignInFallbackProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
      // Auth state listener in useAuth will pick up the session change
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setFormLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      setFormError('Please enter your email address first');
      return;
    }
    setFormError(null);
    setFormLoading(true);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({ email });
      if (otpError) throw otpError;
      setMagicLinkSent(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to send magic link');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Rocket League Bingo</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to start playing</p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-center">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {magicLinkSent ? (
          <div className="rounded-md bg-primary/10 p-4 text-center">
            <p className="text-sm text-foreground font-medium">Check your email</p>
            <p className="mt-1 text-xs text-muted-foreground">
              We sent a sign-in link to <strong>{email}</strong>
            </p>
            <button
              type="button"
              onClick={() => setMagicLinkSent(false)}
              className="mt-3 text-xs text-primary hover:underline"
            >
              Use a different method
            </button>
          </div>
        ) : (
          <form onSubmit={handleEmailPassword} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder="••••••••"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {formError && (
              <p className="text-xs text-destructive">{formError}</p>
            )}

            <button
              type="submit"
              disabled={formLoading}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none"
            >
              {formLoading ? 'Loading...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleMagicLink}
              disabled={formLoading}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none"
            >
              Send Magic Link
            </button>

            <button
              type="button"
              onClick={onRetry}
              disabled={formLoading}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none"
            >
              Retry Anonymous Sign-In
            </button>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground">
          {mode === 'signin' ? (
            <>
              No account?{' '}
              <button
                type="button"
                onClick={() => { setMode('signup'); setFormError(null); }}
                className="text-primary hover:underline"
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('signin'); setFormError(null); }}
                className="text-primary hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
