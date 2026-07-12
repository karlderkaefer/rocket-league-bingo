import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRoom } from '@/features/rooms/hooks/useRoom';
import { validateShareCodeInput } from '@/lib/share-code';

/**
 * JoinRoomPage:
 * - Gets optional `code` param from URL (React Router useParams)
 * - Pre-fills input if code present in URL
 * - Input with validation (1-8 alphanumeric chars)
 * - Submit button calls join(shareCode)
 * - On success → navigate to /game/:roomId
 * - Show errors inline
 */
export function JoinRoomPage() {
  const navigate = useNavigate();
  const { code: urlCode } = useParams<{ code?: string }>();
  const { room, join, isLoading, error, clearError, isActive } = useRoom();

  const [inputValue, setInputValue] = useState(urlCode ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Auto-join if code is present in URL
  useEffect(() => {
    if (urlCode && validateShareCodeInput(urlCode)) {
      join(urlCode);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to game on successful join
  useEffect(() => {
    if (isActive && room) {
      navigate(`/game/${room.id}`);
    }
  }, [isActive, room, navigate]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setInputValue(value);
    setValidationError(null);
    if (error) {
      clearError();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = inputValue.trim();

    if (!trimmed) {
      setValidationError('Please enter a share code.');
      return;
    }

    if (trimmed.length > 8) {
      setValidationError('Share code must be 8 characters or less.');
      return;
    }

    if (!validateShareCodeInput(trimmed)) {
      setValidationError('Share code must contain only letters and numbers.');
      return;
    }

    setValidationError(null);
    join(trimmed);
  }

  const displayError = validationError ?? error;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-4 py-8">
      <h1 className="text-center text-2xl font-bold">Join a Room</h1>
      <p className="text-center text-sm text-muted-foreground">
        Enter the share code from your opponent
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Share Code</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Input
                type="text"
                placeholder="e.g. ABC12345"
                value={inputValue}
                onChange={handleInputChange}
                maxLength={8}
                autoComplete="off"
                autoFocus
                aria-label="Share code input"
                aria-invalid={!!displayError}
                aria-describedby={displayError ? 'join-error' : undefined}
                disabled={isLoading}
              />
              {displayError && (
                <p
                  id="join-error"
                  className="text-sm text-destructive"
                  role="alert"
                >
                  {displayError}
                </p>
              )}
            </div>

            <Button type="submit" disabled={isLoading || !inputValue.trim()}>
              {isLoading ? 'Joining...' : 'Join Room'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
