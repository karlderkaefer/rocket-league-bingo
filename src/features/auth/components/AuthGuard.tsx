import type { ReactNode } from 'react';
import { useAuthContext } from '@/app/providers';

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
    return (
      <div className="flex min-h-dvh items-center justify-center" role="alert">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm px-4">
          <p className="text-sm text-destructive">
            {error ?? 'Authentication failed. Please try again.'}
          </p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
