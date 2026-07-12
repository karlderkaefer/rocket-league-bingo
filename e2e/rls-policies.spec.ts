import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  cleanupTestData,
  getSupabaseAdmin,
} from './helpers/supabase';

/**
 * RLS Integration Tests
 *
 * These tests verify Row Level Security policies on the Supabase database.
 * They run against a local Supabase instance (no browser needed).
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.5, 10.7
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';

/**
 * Creates a Supabase client authenticated as a specific user.
 * Signs in with email/password and returns a client with the user's access token.
 */
async function createAuthenticatedClient(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Failed to sign in as ${email}: ${error.message}`);
  }

  return client;
}

/**
 * Creates a test user and returns both the user info and an authenticated client.
 */
async function createTestUserWithClient(label: string) {
  const admin = getSupabaseAdmin();
  const email = `test-${label}-${Date.now()}@e2e.local`;
  const password = 'test-password-123';

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  const client = await createAuthenticatedClient(email, password);

  return { id: data.user.id, email, client };
}

test.describe('RLS Policies', () => {
  // Run serially — shared state between tests
  test.describe.configure({ mode: 'serial' });

  let hostUser: { id: string; email: string; client: SupabaseClient };
  let guestUser: { id: string; email: string; client: SupabaseClient };
  let thirdUser: { id: string; email: string; client: SupabaseClient };
  let roomId: string;

  test.beforeAll(async () => {
    // Create three test users: host, guest, and a third party
    hostUser = await createTestUserWithClient('host');
    guestUser = await createTestUserWithClient('guest');
    thirdUser = await createTestUserWithClient('third');

    // Host creates a room using admin client (bypasses RLS for setup)
    const admin = getSupabaseAdmin();
    const { data: room, error: roomError } = await admin
      .from('rooms')
      .insert({
        host_id: hostUser.id,
        guest_id: guestUser.id,
        seed: 'test-seed-for-rls',
        category_ids: ['shot-speeds', 'shot-types', 'game-events'],
        share_code: `RLS${Date.now().toString(36).slice(-5)}`,
        status: 'active',
      })
      .select('id')
      .single();

    if (roomError) {
      throw new Error(`Failed to create test room: ${roomError.message}`);
    }

    roomId = room.id;
  });

  test.afterAll(async () => {
    await cleanupTestData([hostUser.id, guestUser.id, thirdUser.id]);
  });

  test('third user cannot read room data', async () => {
    // Validates: Requirement 10.1 — only Host and Guest can read a Room's full record
    // The third user is neither host nor guest, so reading by ID should return no rows
    // (the policy allows reading "waiting" rooms by share_code, but this room is "active")
    const { data, error } = await thirdUser.client
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle();

    // RLS should filter the row out — no error, but no data returned
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  test('guest cannot update room config fields', async () => {
    // Validates: Requirement 10.2 — only the Host can update Room configuration fields
    // Guest attempts to change seed and category_ids
    //
    // Note: PostgREST returns success (no error) even when RLS filters out the row
    // and 0 rows are updated. We verify by checking the data wasn't actually modified.
    await guestUser.client
      .from('rooms')
      .update({ seed: 'hacked-seed' })
      .eq('id', roomId);

    await guestUser.client
      .from('rooms')
      .update({ category_ids: ['hacked-category'] })
      .eq('id', roomId);

    // Verify room data was not modified — this is the real assertion
    const admin = getSupabaseAdmin();
    const { data: room } = await admin
      .from('rooms')
      .select('seed, category_ids')
      .eq('id', roomId)
      .single();

    expect(room?.seed).toBe('test-seed-for-rls');
    expect(room?.category_ids).toEqual(['shot-speeds', 'shot-types', 'game-events']);
  });

  test('player cannot insert mark with another player ID', async () => {
    // Validates: Requirement 10.3 — a Player can only insert marks attributed to their own identity
    // Guest tries to insert a mark with the host's player_id
    const { error } = await guestUser.client
      .from('marks')
      .insert({
        room_id: roomId,
        cell_index: 0,
        player_id: hostUser.id, // Not the guest's own ID!
      });

    // RLS policy: auth.uid() = player_id — this should be rejected
    expect(error).not.toBeNull();

    // Verify no mark was created
    const admin = getSupabaseAdmin();
    const { data: marks } = await admin
      .from('marks')
      .select('*')
      .eq('room_id', roomId)
      .eq('cell_index', 0)
      .eq('player_id', hostUser.id);

    expect(marks).toHaveLength(0);
  });

  test('unauthenticated request is rejected', async () => {
    // Validates: Requirement 10.5 — unauthenticated requests are rejected
    // Create a client with no auth session (just anon key, no sign-in)
    const unauthClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Attempt to read rooms — should get no data due to RLS
    const { data: rooms, error: readError } = await unauthClient
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle();

    // Without auth.uid(), no RLS policy grants access
    // The request doesn't error — Postgres RLS just returns empty results
    expect(readError).toBeNull();
    expect(rooms).toBeNull();

    // Attempt to insert a mark — should be rejected
    const { error: insertError } = await unauthClient
      .from('marks')
      .insert({
        room_id: roomId,
        cell_index: 5,
        player_id: hostUser.id,
      });

    expect(insertError).not.toBeNull();
  });
});
