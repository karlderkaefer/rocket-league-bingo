import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserMenu } from '@/features/auth/components/UserMenu';
import { usePlayerName } from '@/features/auth/hooks/usePlayerName';

const PLAYER_NAME_KEY = 'rl-bingo-player-name';

export function getPlayerName(): string {
  return localStorage.getItem(PLAYER_NAME_KEY) ?? '';
}

export function HomePage() {
  const navigate = useNavigate();
  const derivedName = usePlayerName();
  const [name, setName] = useState(() => getPlayerName() || derivedName);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.slice(0, 20);
    setName(value);
    localStorage.setItem(PLAYER_NAME_KEY, value);
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <UserMenu />
        <ThemeToggle />
      </div>

      <div className="flex flex-col items-center gap-2">
        <h1 className="text-4xl font-bold">Rocket League Bingo</h1>
        <p className="text-muted-foreground">
          Play bingo with your Rocket League buddy
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Input
          type="text"
          placeholder="Your name (optional)"
          value={name}
          onChange={handleNameChange}
          maxLength={20}
          className="text-center"
          aria-label="Player name"
        />

        <Button
          size="lg"
          className="w-full"
          onClick={() => navigate('/create')}
        >
          Create Room
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => navigate('/join')}
        >
          Join Room
        </Button>
      </div>
    </div>
  );
}
