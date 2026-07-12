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
      const { error: otpError } = await supabase.auth.signInWithOtp({ email });
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
