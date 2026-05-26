import type { PersistedState, CellMarks, PlayerRole } from '../types';

const STORAGE_KEY = 'rlb-game-state';

/**
 * Validates that a parsed value conforms to the PersistedState schema.
 * Returns true if the value has all required fields with correct types.
 */
function isValidPersistedState(value: unknown): value is PersistedState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Check seed is a string
  if (typeof obj.seed !== 'string') {
    return false;
  }

  // Check categoryIds is a string array
  if (!Array.isArray(obj.categoryIds) || !obj.categoryIds.every((id) => typeof id === 'string')) {
    return false;
  }

  // Check marks is an array of exactly 25 CellMarks
  if (!Array.isArray(obj.marks) || obj.marks.length !== 25) {
    return false;
  }
  for (const mark of obj.marks) {
    if (typeof mark !== 'object' || mark === null) {
      return false;
    }
    const m = mark as Record<string, unknown>;
    if (typeof m.hostMarked !== 'boolean' || typeof m.guestMarked !== 'boolean') {
      return false;
    }
  }

  // Check myRole is 'host' or 'guest'
  if (obj.myRole !== 'host' && obj.myRole !== 'guest') {
    return false;
  }

  // Check peerId is a string
  if (typeof obj.peerId !== 'string') {
    return false;
  }

  // Check remotePeerId is a string
  if (typeof obj.remotePeerId !== 'string') {
    return false;
  }

  // Check timestamp is a number
  if (typeof obj.timestamp !== 'number') {
    return false;
  }

  return true;
}

/**
 * Serialize and store game state in localStorage.
 * Handles QuotaExceededError gracefully by logging a warning and continuing.
 */
export function saveGameState(state: PersistedState): void {
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, json);
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded — game state will not be persisted.');
    } else {
      console.warn('Failed to save game state:', error);
    }
  }
}

/**
 * Load and validate game state from localStorage.
 * Returns null if no state exists, JSON is corrupted, or schema validation fails.
 * Clears corrupted data on failure.
 */
export function loadGameState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    if (!isValidPersistedState(parsed)) {
      // Schema validation failed — clear corrupted data
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    // JSON parse error or other failure — clear corrupted data
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * Remove persisted game state from localStorage.
 */
export function clearGameState(): void {
  localStorage.removeItem(STORAGE_KEY);
}
