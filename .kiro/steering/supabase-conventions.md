# Supabase Conventions

## Agent Skill Requirement

When performing ANY Supabase-related work (migrations, RLS policies, auth configuration, realtime setup, type generation, database queries, etc.), **activate the `supabase` skill via `disclose_context`** before proceeding. If the skill is not available via that tool, read `.agents/skills/supabase/SKILL.md` directly.

Key rules from the Supabase skill:
- Verify against changelog and current docs before implementing
- Use `execute_sql` (MCP) or `supabase db query` for iterating on schema changes — NOT `apply_migration`
- When ready to commit: run advisors → review security checklist → `supabase db pull <name> --local --yes`
- Enable RLS on every table in exposed schemas
- Never use `user_metadata` for authorization decisions
- Use MCP `search_docs` tool to look up Supabase documentation

## Local Development

Always use the Supabase CLI for local development:

```bash
supabase start          # Start local Supabase stack
supabase stop           # Stop local stack
supabase status         # Show local URLs and keys
supabase db reset       # Reset DB and re-run all migrations + seed
supabase gen types typescript --local > src/database.types.ts
```

## Migrations

- All schema changes go through SQL migration files in `supabase/migrations/`.
- Create new migrations with: `supabase migration new <name>`
- Never edit the database schema manually in production or via the dashboard.
- Migrations are applied in filename order (timestamped).
- Include RLS policies in the same migration that creates the table.

### Migration file conventions

```sql
-- supabase/migrations/20260712000000_create_rooms.sql

-- Create table
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ...
);

-- Enable RLS
alter table public.rooms enable row level security;

-- RLS policies (always in the same migration)
create policy "Host and Guest can read their room"
  on public.rooms for select
  using (auth.uid() = host_id or auth.uid() = guest_id);
```

## Row Level Security

- **Every table** must have RLS enabled. No exceptions.
- Write policies that are as restrictive as possible.
- Use `auth.uid()` to reference the current user's ID.
- Test RLS policies locally before deploying.
- The anon key is safe to expose in the browser ONLY because RLS is in place.

## Realtime

Use Supabase Realtime **Broadcast** for game actions (mark/unmark), not database change listeners:

```typescript
// Subscribe to a room channel
const channel = supabase.channel(`room:${roomId}`);

channel
  .on('broadcast', { event: 'mark' }, (payload) => {
    // Handle mark action
  })
  .on('broadcast', { event: 'unmark' }, (payload) => {
    // Handle unmark action
  })
  .subscribe();

// Send a broadcast
channel.send({
  type: 'broadcast',
  event: 'mark',
  payload: { cellIndex: 5, player: 'host' },
});
```

Why Broadcast over Postgres Changes:
- Lower latency (no DB round-trip for the subscriber)
- No need to expose table change events
- Works well with optimistic UI updates
- Database is the source of truth for conflict resolution

## Authentication

- Use Anonymous Auth as the default sign-in method (no friction for players).
- The Supabase client persists sessions in localStorage automatically.
- On app load, call `supabase.auth.getSession()` to check existing session.
- Listen to auth state changes with `supabase.auth.onAuthStateChange()`.

```typescript
// Auto sign-in on first visit
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  await supabase.auth.signInAnonymously();
}
```

## Database Design Principles

- Use `uuid` for primary keys (default: `gen_random_uuid()`).
- Use `timestamptz` for all timestamps (never `timestamp` without timezone).
- Use enum types or check constraints for status fields.
- Add `created_at` and `updated_at` columns to all tables.
- Foreign keys reference `auth.users(id)` for player relationships.
- Keep the schema simple — this is a two-player bingo game, not an enterprise ERP.

## Type Generation

After any migration change, regenerate types:

```bash
supabase gen types typescript --local > src/database.types.ts
```

Then use them in queries:

```typescript
import type { Database } from '@/database.types';

type Room = Database['public']['Tables']['rooms']['Row'];
type InsertRoom = Database['public']['Tables']['rooms']['Insert'];
```

## Key Security

Your browser may safely contain:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

The publishable key is designed to be exposed. Protection comes from PostgreSQL permissions and Row Level Security, which must be enabled on every exposed table.

Never include in client code:

```
SUPABASE_SECRET_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=...
```

Those belong only in Supabase Edge Functions or another protected backend because they can bypass RLS or provide privileged database access.

## Error Handling

- Always check `.error` on Supabase responses.
- Show user-friendly messages, log technical details to console.
- Use optimistic updates for marks (update UI immediately, persist in background).
- Retry failed database writes up to 3 times with exponential backoff.

```typescript
const { data, error } = await supabase
  .from('rooms')
  .select('*')
  .eq('share_code', code)
  .single();

if (error) {
  // Handle error — show toast, log details
  console.error('Room lookup failed:', error.message);
}
```
