-- Create marks table
create table public.marks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  cell_index smallint not null,
  player_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),

  constraint marks_cell_index_range check (cell_index >= 0 and cell_index < 25),
  constraint marks_unique_per_player unique (room_id, cell_index, player_id)
);

-- Index for room-based lookups
create index marks_room_id_idx on public.marks (room_id);

-- Enable Row Level Security
alter table public.marks enable row level security;

-- RLS Policies

-- Participants (host or guest) can read all marks in their room
create policy "Participants can read marks"
  on public.marks for select
  using (
    exists (
      select 1 from public.rooms
      where rooms.id = marks.room_id
      and (rooms.host_id = auth.uid() or rooms.guest_id = auth.uid())
    )
  );

-- Players can insert their own marks in active rooms they participate in
create policy "Players can insert own marks"
  on public.marks for insert
  with check (
    auth.uid() = player_id
    and exists (
      select 1 from public.rooms
      where rooms.id = marks.room_id
      and rooms.status = 'active'
      and (rooms.host_id = auth.uid() or rooms.guest_id = auth.uid())
    )
  );

-- Players can delete their own marks in active rooms they participate in
create policy "Players can delete own marks"
  on public.marks for delete
  using (
    auth.uid() = player_id
    and exists (
      select 1 from public.rooms
      where rooms.id = marks.room_id
      and rooms.status = 'active'
      and (rooms.host_id = auth.uid() or rooms.guest_id = auth.uid())
    )
  );

-- Grant table access to roles
grant select, insert, update, delete on public.marks to anon, authenticated, service_role;
