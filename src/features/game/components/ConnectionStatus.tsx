import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { ConnectionState } from '@/features/rooms/hooks/useRoomChannel';

interface ConnectionStatusProps {
  connectionState: ConnectionState;
  onRetry: () => void;
}

/**
 * Connection status indicator — ONLY shows when there's a problem.
 * When connected, renders nothing (no flickering dot).
 * Shows reconnecting/error state only after the user was previously connected.
 */
export function ConnectionStatus({ connectionState, onRetry }: ConnectionStatusProps) {
  const [showProblem, setShowProblem] = useState(false);
  const wasConnectedRef = useRef(false);

  useEffect(() => {
    if (connectionState === 'connected') {
      wasConnectedRef.current = true;
      setShowProblem(false);
    }
  }, [connectionState]);

  useEffect(() => {
    if (connectionState === 'disconnected' && wasConnectedRef.current) {
      const timer = setTimeout(() => setShowProblem(true), 3000);
      return () => clearTimeout(timer);
    }
    if (connectionState === 'error') {
      setShowProblem(true);
    }
  }, [connectionState]);

  // Error: always show
  if (connectionState === 'error' && showProblem) {
    return (
      <div
        role="alert"
        className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs text-destructive"
      >
        <span>Connection lost</span>
        <Button size="sm" variant="destructive" onClick={onRetry} className="h-5 px-2 text-xs">
          Retry
        </Button>
      </div>
    );
  }

  // Disconnected: show after delay
  if (showProblem && connectionState === 'disconnected') {
    return (
      <div
        role="status"
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-yellow-500" aria-hidden="true" />
        <span>Reconnecting…</span>
      </div>
    );
  }

  // Connected or initial connecting: show nothing
  return null;
}
