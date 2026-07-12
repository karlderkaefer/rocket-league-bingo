import { useState } from 'react';
import { useAuthContext } from '@/app/providers';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export function UserMenu() {
  const { user } = useAuthContext();
  const isAnonymous = user?.is_anonymous ?? true;

  if (isAnonymous) {
    return <SignInButton />;
  }

  return <AccountButton email={user?.email ?? ''} />;
}

function SignInButton() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" />}
      >
        Sign In
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign in to your account</DialogTitle>
          <DialogDescription>
            Link your anonymous session to an email account to keep your game history across devices.
          </DialogDescription>
        </DialogHeader>
        <SignInForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

interface AccountButtonProps {
  email: string;
}

function AccountButton({ email }: AccountButtonProps) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    // The auth state listener will reset the session and re-trigger anonymous sign-in
    setSigningOut(false);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground truncate max-w-[120px]">
        {email}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        disabled={signingOut}
      >
        Sign Out
      </Button>
    </div>
  );
}

interface SignInFormProps {
  onSuccess: () => void;
}

function SignInForm({ onSuccess }: SignInFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [linkEmailSent, setLinkEmailSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        // Link anonymous account to email identity.
        // Per Supabase docs: first link the email (triggers verification email),
        // then after verification the user can set a password.
        const { error: linkError } = await supabase.auth.updateUser({ email });
        if (linkError) throw linkError;
        setLinkEmailSent(true);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!email) {
      setError('Enter your email address first');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (otpError) throw otpError;
      setMagicLinkSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  }

  if (linkEmailSent) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <p className="text-sm font-medium">Check your email</p>
        <p className="text-xs text-muted-foreground text-center">
          We sent a verification link to <strong>{email}</strong>. Confirm it to link your account.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLinkEmailSent(false)}
        >
          Try another method
        </Button>
      </div>
    );
  }

  if (magicLinkSent) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <p className="text-sm font-medium">Check your email</p>
        <p className="text-xs text-muted-foreground text-center">
          We sent a sign-in link to <strong>{email}</strong>
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMagicLinkSent(false)}
        >
          Try another method
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="auth-email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="auth-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>

      {mode === 'signin' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="auth-password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="auth-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Loading...' : mode === 'signup' ? 'Link Email to Account' : 'Sign In'}
      </Button>

      <div className="relative my-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-popover px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleMagicLink}
        disabled={loading}
        className="w-full"
      >
        Send Magic Link
      </Button>

      <OAuthProviders disabled={loading} />

      <p className="text-center text-xs text-muted-foreground pt-1">
        {mode === 'signin' ? (
          <>
            No account?{' '}
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); }}
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
              onClick={() => { setMode('signin'); setError(null); }}
              className="text-primary hover:underline"
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </form>
  );
}

interface OAuthProvidersProps {
  disabled?: boolean;
}

/**
 * OAuth provider buttons.
 * For anonymous users, uses linkIdentity to preserve the session.
 * For unauthenticated users (AuthGuard fallback), uses signInWithOAuth.
 */
function OAuthProviders({ disabled }: OAuthProvidersProps) {
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(false);

  async function handleGitHub() {
    setLoading(true);
    try {
      if (user?.is_anonymous) {
        // Link the anonymous account to a GitHub identity
        const { error } = await supabase.auth.linkIdentity({ provider: 'github' });
        if (error) throw error;
      } else {
        // Sign in with GitHub (no existing session or non-anonymous user)
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'github',
          options: { redirectTo: window.location.origin },
        });
        if (error) throw error;
      }
    } catch (err) {
      console.error('GitHub auth failed:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleGitHub}
      disabled={disabled || loading}
      className="w-full"
    >
      <Github className="mr-2 h-4 w-4" />
      Continue with GitHub
    </Button>
  );
}

function Github({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  );
}
