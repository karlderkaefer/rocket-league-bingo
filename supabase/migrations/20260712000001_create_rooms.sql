-- Create room_status enum
create type room_status as enum ('waiting', 'active', 'completed', 'expired');

-- Create rooms table
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  host_id uuid not null references auth.users(id),
  guest_id uuid references auth.users(id),
  seed text not null,
  category_ids text[] not null,
  share_code text not null,
  status room_status not null default 'waiting',

  constraint rooms_share_code_unique unique (share_code),
  constraint rooms_seed_not_empty check (length(seed) > 0),
  constraint rooms_category_ids_not_empty check (array_length(category_ids, 1) >= 1)
);

-- Indexes
create index rooms_share_code_idx on public.rooms (share_code);
create index rooms_host_id_idx on public.rooms (host_id) where status in ('waiting', 'active');
create index rooms_guest_id_idx on public.rooms (guest_id) where status = 'active';

-- Enable Row Level Security
alter table public.rooms enable row level security;

-- RLS Policies

-- Participants (host/guest) can read their room; authenticated users can look up waiting rooms by share_code
create policy "Participants can read their room"
  on public.rooms for select
  using (
    auth.uid() = host_id
    or auth.uid() = guest_id
    or (auth.uid() is not null and status = 'waiting' and share_code is not null)
  );

-- Only authenticated users can create rooms (must be the host)
create policy "Authenticated users can create rooms"
  on public.rooms for insert
  with check (auth.uid() = host_id);

-- Host can update their own room (any fields, but cannot set guest_id = host_id)
create policy "Host can update own room"
  on public.rooms for update
  using (auth.uid() = host_id)
  with check (auth.uid() = host_id and (guest_id is null or guest_id != host_id));

-- Guest can only join a waiting room with no guest assigned
create policy "Guest can join waiting room"
  on public.rooms for update
  using (
    status = 'waiting' and guest_id is null
  )
  with check (
    auth.uid() = guest_id
    and status = 'active'
    and guest_id != host_id
  );

-- Grant table access to roles
grant select, insert, update, delete on public.rooms to anon, authenticated, service_role;

-- Enable Realtime (Postgres Changes) for the rooms table
alter publication supabase_realtime add table public.rooms;
