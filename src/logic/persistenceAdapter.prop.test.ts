import { test, fc } from '@fast-check/vitest';
import { beforeEach } from 'vitest';
import { saveGameState, loadGameState } from './persistenceAdapter';
import type { PersistedState } from '../types';

/**
 * Property 8: Game state persistence round-trip
 * Validates: Requirements 8.2, 8.5
 *
 * For any valid game state (including seed, category selection, marks with
 * player attribution, and connection info), persisting to localStorage and
 * then loading should produce an equivalent game state.
 */

const persistedStateArb = fc.record({
  seed: fc.string({ minLength: 1 }),
  categoryIds: fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
  marks: fc.array(
    fc.record({ hostMarked: fc.boolean(), guestMarked: fc.boolean() }),
    { minLength: 25, maxLength: 25 }
  ),
  myRole: fc.constantFrom('host', 'guest') as fc.Arbitrary<'host' | 'guest'>,
  peerId: fc.string({ minLength: 1 }),
  remotePeerId: fc.string({ minLength: 1 }),
  timestamp: fc.nat(),
});

beforeEach(() => {
  localStorage.clear();
});

test.prop([persistedStateArb], { numRuns: 100 })(
  'saving then loading game state produces equivalent state',
  (state: PersistedState) => {
    saveGameState(state);
    const loaded = loadGameState();
    expect(loaded).toEqual(state);
  }
);
