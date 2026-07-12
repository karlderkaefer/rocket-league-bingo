-- Add player name columns to rooms table
-- Allows displaying opponent names during gameplay

alter table public.rooms add column host_name text;
alter table public.rooms add column guest_name text;

-- Limit name length (matches the 20-char frontend limit)
alter table public.rooms
  add constraint rooms_host_name_length check (host_name is null or length(host_name) <= 20);
alter table public.rooms
  add constraint rooms_guest_name_length check (guest_name is null or length(guest_name) <= 20);
