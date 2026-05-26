import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveGameState, loadGameState, clearGameState } from './persistenceAdapter';
import type { PersistedState } from '../types';

const validState: PersistedState = {
  seed: 'test-seed-abc123',
  categoryIds: ['shot-speeds', 'shot-types'],
  marks: Array.from({ length: 25 }, () => ({ hostMarked: false, guestMarked: false })),
  myRole: 'host',
  peerId: 'rlb-abc123',
  remotePeerId: 'guest-peer-id',
  timestamp: Date.now(),
};

describe('persistenceAdapter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('saveGameState', () => {
    it('stores serialized state in localStorage', () => {
      saveGameState(validState);
      const stored = localStorage.getItem('rlb-game-state');
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!)).toEqual(validState);
    });

    it('handles QuotaExceededError gracefully', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = new DOMException('Storage full', 'QuotaExceededError');
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw error;
      });

      // Should not throw
      expect(() => saveGameState(validState)).not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(
        'localStorage quota exceeded — game state will not be persisted.'
      );

      warnSpy.mockRestore();
      vi.restoreAllMocks();
    });

    it('handles other storage errors gracefully', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Unknown error');
      });

      expect(() => saveGameState(validState)).not.toThrow();
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
      vi.restoreAllMocks();
    });
  });

  describe('loadGameState', () => {
    it('returns the stored state when valid', () => {
      localStorage.setItem('rlb-game-state', JSON.stringify(validState));
      const loaded = loadGameState();
      expect(loaded).toEqual(validState);
    });

    it('returns null when no state exists', () => {
      expect(loadGameState()).toBeNull();
    });

    it('returns null and clears data when JSON is corrupted', () => {
      localStorage.setItem('rlb-game-state', 'not valid json {{{');
      const loaded = loadGameState();
      expect(loaded).toBeNull();
      expect(localStorage.getItem('rlb-game-state')).toBeNull();
    });

    it('returns null and clears data when schema validation fails (missing seed)', () => {
      const invalid = { ...validState, seed: undefined };
      localStorage.setItem('rlb-game-state', JSON.stringify(invalid));
      expect(loadGameState()).toBeNull();
      expect(localStorage.getItem('rlb-game-state')).toBeNull();
    });

    it('returns null and clears data when marks array has wrong length', () => {
      const invalid = { ...validState, marks: [{ hostMarked: false, guestMarked: false }] };
      localStorage.setItem('rlb-game-state', JSON.stringify(invalid));
      expect(loadGameState()).toBeNull();
      expect(localStorage.getItem('rlb-game-state')).toBeNull();
    });

    it('returns null and clears data when marks have invalid structure', () => {
      const invalidMarks = Array.from({ length: 25 }, () => ({ hostMarked: 'yes', guestMarked: false }));
      const invalid = { ...validState, marks: invalidMarks };
      localStorage.setItem('rlb-game-state', JSON.stringify(invalid));
      expect(loadGameState()).toBeNull();
      expect(localStorage.getItem('rlb-game-state')).toBeNull();
    });

    it('returns null and clears data when myRole is invalid', () => {
      const invalid = { ...validState, myRole: 'spectator' };
      localStorage.setItem('rlb-game-state', JSON.stringify(invalid));
      expect(loadGameState()).toBeNull();
      expect(localStorage.getItem('rlb-game-state')).toBeNull();
    });

    it('returns null and clears data when categoryIds contains non-strings', () => {
      const invalid = { ...validState, categoryIds: [123, 'valid'] };
      localStorage.setItem('rlb-game-state', JSON.stringify(invalid));
      expect(loadGameState()).toBeNull();
      expect(localStorage.getItem('rlb-game-state')).toBeNull();
    });

    it('returns null and clears data when timestamp is not a number', () => {
      const invalid = { ...validState, timestamp: 'not-a-number' };
      localStorage.setItem('rlb-game-state', JSON.stringify(invalid));
      expect(loadGameState()).toBeNull();
      expect(localStorage.getItem('rlb-game-state')).toBeNull();
    });

    it('returns null and clears data when value is null', () => {
      localStorage.setItem('rlb-game-state', 'null');
      expect(loadGameState()).toBeNull();
      expect(localStorage.getItem('rlb-game-state')).toBeNull();
    });

    it('returns null and clears data when value is a primitive', () => {
      localStorage.setItem('rlb-game-state', '"just a string"');
      expect(loadGameState()).toBeNull();
      expect(localStorage.getItem('rlb-game-state')).toBeNull();
    });
  });

  describe('clearGameState', () => {
    it('removes persisted state from localStorage', () => {
      localStorage.setItem('rlb-game-state', JSON.stringify(validState));
      clearGameState();
      expect(localStorage.getItem('rlb-game-state')).toBeNull();
    });

    it('does not throw when no state exists', () => {
      expect(() => clearGameState()).not.toThrow();
    });
  });
});
