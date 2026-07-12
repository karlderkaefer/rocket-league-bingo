-- Seed data for local development
-- Run with: supabase db reset

-- Create test users in auth.users
-- These UUIDs are hardcoded so seed data is deterministic
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  is_anonymous
) values (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'host@test.local',
  '',
  now(),
  now(),
  now(),
  '',
  '',
  true
), (
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'guest@test.local',
  '',
  now(),
  now(),
  now(),
  '',
  '',
  true
);

-- Create identities for the test users (required by Supabase auth)
insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  created_at,
  updated_at,
  last_sign_in_at
) values (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '{"sub": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"}',
  'anonymous',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  now(),
  now(),
  now()
), (
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  '{"sub": "b2c3d4e5-f6a7-8901-bcde-f12345678901"}',
  'anonymous',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  now(),
  now(),
  now()
);

-- Create a sample room (active, with both players)
insert into public.rooms (
  id,
  host_id,
  guest_id,
  seed,
  category_ids,
  share_code,
  status
) values (
  '11111111-2222-3333-4444-555555555555',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'test-seed-abc123',
  array['shot-speeds', 'shot-types', 'game-events'],
  'TEST1234',
  'active'
);

-- Create a sample waiting room (host only, no guest yet)
insert into public.rooms (
  id,
  host_id,
  guest_id,
  seed,
  category_ids,
  share_code,
  status
) values (
  '22222222-3333-4444-5555-666666666666',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  null,
  'waiting-room-seed',
  array['shot-speeds', 'game-events'],
  'WAIT5678',
  'waiting'
);

-- Add some sample marks to the active room
insert into public.marks (room_id, cell_index, player_id) values
  ('11111111-2222-3333-4444-555555555555', 0, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('11111111-2222-3333-4444-555555555555', 4, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('11111111-2222-3333-4444-555555555555', 12, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('11111111-2222-3333-4444-555555555555', 0, 'b2c3d4e5-f6a7-8901-bcde-f12345678901'),
  ('11111111-2222-3333-4444-555555555555', 6, 'b2c3d4e5-f6a7-8901-bcde-f12345678901'),
  ('11111111-2222-3333-4444-555555555555', 12, 'b2c3d4e5-f6a7-8901-bcde-f12345678901');
