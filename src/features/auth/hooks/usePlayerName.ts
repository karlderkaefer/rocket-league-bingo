import type { User } from '@supabase/supabase-js';
import { useAuthContext } from '@/app/providers';

const PLAYER_NAME_KEY = 'rl-bingo-player-name';

/**
 * Returns the player's display name using this priority:
 * 1. Manually set name in localStorage (user typed it in the input)
 * 2. Provider name from user metadata (e.g. Google/GitHub display name)
 * 3. Email local part (before the @)
 * 4. Empty string (anonymous with no name set)
 */
export function usePlayerName(): string {
  const { user } = useAuthContext();
  return resolvePlayerName(user);
}

/**
 * Pure helper that derives display name from a User object.
 * Exported for use in non-hook contexts if needed.
 */
export function resolvePlayerName(user: User | null): string {
  // Priority 1: manually set localStorage name
  const stored = localStorage.getItem(PLAYER_NAME_KEY);
  if (stored) return stored;

  if (!user || user.is_anonymous) return '';

  // Priority 2: provider display name from user_metadata
  const meta = user.user_metadata;
  if (meta?.full_name) return truncate(meta.full_name);
  if (meta?.name) return truncate(meta.name);
  if (meta?.preferred_username) return truncate(meta.preferred_username);

  // Priority 3: email local part
  if (user.email) {
    const localPart = user.email.split('@')[0] ?? '';
    return truncate(localPart);
  }

  return '';
}

function truncate(value: string, max = 20): string {
  return value.slice(0, max);
}
