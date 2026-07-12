import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns a Supabase admin client using the service role key.
 * This client bypasses RLS and should ONLY be used in the Playwright test runner process.
 */
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. ' +
        'Run `supabase status` to get the service_role key and add it to your environment.'
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

interface TestUser {
  id: string;
  email: string;
}

/**
 * Creates a test user via the Supabase Admin API.
 * Returns the user ID and generated email for cleanup.
 */
export async function createTestUser(
  label = 'player'
): Promise<TestUser> {
  const admin = getSupabaseAdmin();
  const email = `test-${label}-${Date.now()}@e2e.local`;
  const password = 'test-password-123';

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message || JSON.stringify(error)}`);
  }

  return { id: data.user.id, email };
}

/**
 * Cleans up test data created during E2E tests.
 * Removes marks and rooms associated with the given user IDs.
 */
export async function cleanupTestData(userIds: string[]): Promise<void> {
  const admin = getSupabaseAdmin();

  for (const userId of userIds) {
    // Delete marks by this user
    await admin.from('marks').delete().eq('player_id', userId);

    // Delete rooms where user is host or guest
    await admin.from('rooms').delete().eq('host_id', userId);
    await admin.from('rooms').delete().eq('guest_id', userId);

    // Delete the test user
    await admin.auth.admin.deleteUser(userId);
  }
}
