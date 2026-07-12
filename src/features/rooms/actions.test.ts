import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createRoom, joinRoom, endGame } from './actions';

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/share-code', () => ({
  encodeShareCode: vi.fn(() => 'ABC12345'),
}));

import { supabase } from '@/lib/supabase/client';

const mockFrom = supabase.from as Mock;

describe('createRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a room with correct fields and returns roomId + shareCode', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });

    const result = await createRoom({
      categoryIds: ['shot-speeds', 'game-events'],
      hostId: 'host-user-123',
    });

    expect(mockFrom).toHaveBeenCalledWith('rooms');
    expect(mockInsert).toHaveBeenCalledOnce();

    const insertArg = mockInsert.mock.calls[0]![0];
    expect(insertArg).toMatchObject({
      host_id: 'host-user-123',
      category_ids: ['shot-speeds', 'game-events'],
      share_code: 'ABC12345',
      status: 'waiting',
    });
    // Seed should be a non-empty string
    expect(insertArg.seed).toBeDefined();
    expect(insertArg.seed.length).toBeGreaterThan(0);
    // ID should be a UUID
    expect(insertArg.id).toBeDefined();
    expect(insertArg.id.length).toBeGreaterThan(0);

    expect(result.shareCode).toBe('ABC12345');
    expect(result.roomId).toBe(insertArg.id);
  });

  it('throws an error when database insert fails', async () => {
    const mockInsert = vi.fn().mockResolvedValue({
      error: { message: 'Duplicate share_code' },
    });
    mockFrom.mockReturnValue({ insert: mockInsert });

    await expect(
      createRoom({ categoryIds: ['shot-speeds'], hostId: 'host-1' })
    ).rejects.toThrow('Room creation failed: Duplicate share_code');
  });
});

describe('joinRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Build a chainable mock for supabase.from('rooms').select('*').eq(...).single()
   */
  function setupLookup(data: unknown, error: unknown = null) {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data, error }),
    };
    mockFrom.mockReturnValue(chain);
  }

  /**
   * Build mocks for both the select (lookup) call and the update (join) call.
   */
  function setupJoinFlow(lookupData: unknown, updateData: unknown, updateError: unknown = null) {
    // Lookup chain: from('rooms').select('*').eq('share_code', code).single()
    const lookupChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: lookupData, error: null }),
    };

    // Update chain: from('rooms').update({...}).eq('id', ...).eq('status', ...).is('guest_id', null).select().single()
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updateData, error: updateError }),
    };

    mockFrom
      .mockReturnValueOnce(lookupChain)
      .mockReturnValueOnce(updateChain);
  }

  it('throws error when share code does not match any room', async () => {
    setupLookup(null, { message: 'No rows found' });

    await expect(joinRoom('INVALID1', 'guest-1')).rejects.toThrow(
      'Invalid share code. Please check and try again.'
    );
  });

  it('throws error when room status is not waiting', async () => {
    setupLookup({
      id: 'room-1',
      status: 'active',
      guest_id: 'another-guest',
      share_code: 'ABC12345',
    });

    await expect(joinRoom('ABC12345', 'guest-1')).rejects.toThrow(
      'This room is no longer available.'
    );
  });

  it('throws error when room already has a guest', async () => {
    setupLookup({
      id: 'room-1',
      status: 'waiting',
      guest_id: 'existing-guest',
      share_code: 'ABC12345',
    });

    await expect(joinRoom('ABC12345', 'guest-1')).rejects.toThrow(
      'This room is no longer available.'
    );
  });

  it('successfully joins a valid waiting room', async () => {
    const updatedRoom = {
      id: 'room-1',
      status: 'active',
      host_id: 'host-1',
      guest_id: 'guest-1',
      share_code: 'ABC12345',
      seed: 'test-seed',
      category_ids: ['shot-speeds'],
    };

    setupJoinFlow(
      { id: 'room-1', status: 'waiting', guest_id: null, share_code: 'ABC12345' },
      updatedRoom
    );

    const result = await joinRoom('ABC12345', 'guest-1');
    expect(result).toEqual(updatedRoom);
  });

  it('throws error when atomic update fails (race condition)', async () => {
    setupJoinFlow(
      { id: 'room-1', status: 'waiting', guest_id: null, share_code: 'ABC12345' },
      null,
      { message: 'Row not found' }
    );

    await expect(joinRoom('ABC12345', 'guest-1')).rejects.toThrow(
      'Failed to join room. It may have been claimed by another player.'
    );
  });
});

describe('endGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates room status to completed', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: null }),
    };
    mockFrom.mockReturnValue(chain);

    await endGame('room-123');

    expect(mockFrom).toHaveBeenCalledWith('rooms');
    expect(chain.update).toHaveBeenCalledWith({ status: 'completed' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'room-123');
    expect(chain.in).toHaveBeenCalledWith('status', ['waiting', 'active']);
  });

  it('throws error when update fails', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: { message: 'Not found' } }),
    };
    mockFrom.mockReturnValue(chain);

    await expect(endGame('room-123')).rejects.toThrow(
      'Failed to end game: Not found'
    );
  });
});
