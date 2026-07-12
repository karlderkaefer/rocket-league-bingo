# Implementation Plan: Rocket League Bingo — Supabase Migration

## Overview

This plan migrates the Rocket League Bingo app from PeerJS/WebRTC + localStorage to a Supabase-backed architecture. The frontend stays as a Vite + React 19 + TypeScript SPA. We clean up old dependencies, set up Supabase (database, auth, realtime), implement pure logic modules with property tests, build out room management and game features, wire up realtime sync, and finish with UI polish and E2E testing.

## Tasks

- [x] 1. Project scaffolding and dependency setup
  - [x] 1.1 Clean up old PeerJS code and dependencies
    - Remove `peerjs` from `package.json` dependencies
    - Delete old PeerJS connection manager and related files (e.g., `src/hooks/useConnection.ts`, `src/services/peer.ts`, or equivalent)
    - Remove old CSS modules that are no longer used by the new architecture
    - Clean up unused component files from the flat `src/components/` structure
    - _Requirements: N/A (cleanup for migration)_

  - [x] 1.2 Install new dependencies and configure project structure
    - Install: `@supabase/supabase-js`, `zod`, `react-hook-form`, `@hookform/resolvers`, `tailwindcss`, `@tailwindcss/vite`
    - Install devDependencies: `supabase` (CLI), `@playwright/test`
    - Configure `@/` path alias in `vite.config.ts` and `tsconfig.json`
    - Create feature-based directory structure: `src/app/`, `src/features/auth/`, `src/features/rooms/`, `src/features/game/`, `src/features/categories/`, `src/lib/supabase/`, `src/components/ui/`
    - Update `vite.config.ts` with path alias resolver
    - _Requirements: N/A (infrastructure)_

  - [x] 1.3 Initialize Supabase project locally
    - Run `supabase init` to create `supabase/` directory with `config.toml`
    - Create `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` placeholders
    - Add `supabase/.temp/` to `.gitignore`
    - _Requirements: N/A (infrastructure)_

  - [x] 1.4 Configure Tailwind CSS and shadcn/ui
    - Set up Tailwind CSS v4 with the Vite plugin (`@tailwindcss/vite`)
    - Create `src/index.css` with Tailwind imports
    - Initialize shadcn/ui (`npx shadcn@latest init`) and add base components: Button, Input, Card, Dialog
    - _Requirements: N/A (infrastructure)_

- [x] 2. Database migrations
  - [x] 2.1 Create rooms table migration
    - Create `supabase/migrations/<timestamp>_create_rooms.sql`
    - Define `room_status` enum (`waiting`, `active`, `completed`, `expired`)
    - Create `rooms` table with columns: `id` (UUID PK), `created_at`, `updated_at`, `host_id`, `guest_id`, `seed`, `category_ids` (text[]), `share_code`, `status`
    - Add constraints: unique `share_code`, non-empty seed, non-empty category_ids
    - Add indexes: `share_code`, `host_id` (partial for active rooms), `guest_id` (partial for active rooms)
    - Enable RLS on rooms table
    - Create RLS policies: participants select, authenticated insert (as host), guest join update, host status update
    - _Requirements: 2.2, 9.1, 10.1, 10.2, 10.4, 10.5, 10.6, 10.7_

  - [x] 2.2 Create marks table migration
    - Create `supabase/migrations/<timestamp>_create_marks.sql`
    - Create `marks` table with columns: `id` (UUID PK), `room_id` (FK to rooms), `cell_index` (smallint 0-24), `player_id` (FK to auth.users), `created_at`
    - Add constraints: cell_index range check (0-24), unique per player per cell per room
    - Add index on `room_id`
    - Enable RLS on marks table
    - Create RLS policies: participants select, players insert own marks in active rooms, players delete own marks in active rooms
    - _Requirements: 9.2, 9.5, 10.1, 10.3, 10.7_

  - [x] 2.3 Create seed data and generate types
    - Create `supabase/seed.sql` with sample development data (optional rooms for testing)
    - Create placeholder `src/database.types.ts` file (to be regenerated via `supabase gen types typescript --local`)
    - _Requirements: N/A (development tooling)_

- [x] 3. Supabase client setup and authentication
  - [x] 3.1 Create Supabase client singleton
    - Create `src/lib/supabase/client.ts` with typed `createClient<Database>` using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
    - Create `src/lib/supabase/types.ts` with re-exports from `database.types.ts`
    - _Requirements: 1.1_

  - [x] 3.2 Implement auth hook and provider
    - Create `src/features/auth/hooks/useAuth.ts` with: auto sign-in via anonymous auth on first load, session persistence check, `signInAnonymously()` call, auth state listener, loading/error states
    - Create `src/features/auth/components/AuthGuard.tsx` that wraps routes requiring authentication and shows loading or error UI
    - Create `src/app/providers.tsx` with AuthProvider context
    - Handle 10-second timeout for auth failure with retry option
    - _Requirements: 1.1, 1.2, 1.5_

  - [x] 3.3 Write unit tests for auth hook
    - Test: auto sign-in called when no session exists
    - Test: existing session reused on subsequent loads
    - Test: error state shown when auth fails
    - Test: retry mechanism works after failure
    - _Requirements: 1.1, 1.2, 1.5_

- [x] 4. Checkpoint - Ensure scaffolding builds cleanly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Pure logic modules and property tests
  - [x] 5.1 Implement share-code module
    - Create `src/lib/share-code.ts` with: `encodeShareCode(roomId: string): string`, `decodeShareCode(code: string): string | null`, `buildShareUrl(code: string): string`, `parseShareUrl(url: string): string | null`, `validateShareCodeInput(input: string): boolean`
    - Encoding: convert UUID to base62, take first 8 characters
    - Validation: reject empty, >8 chars, non-alphanumeric
    - _Requirements: 2.3, 3.1, 3.2, 3.8_

  - [x] 5.2 Write property tests for share-code module
    - **Property 1: Share code round-trip** — For any UUID, encode then decode returns the original UUID; code is ≤8 alphanumeric chars. Also buildShareUrl/parseShareUrl round-trips.
    - **Validates: Requirements 2.3, 3.1**
    - **Property 10: Share code input validation** — Empty, >8 chars, or non-alphanumeric strings are rejected without DB request.
    - **Validates: Requirements 3.8**
    - Create `src/lib/share-code.prop.test.ts`
    - _Requirements: 2.3, 3.1, 3.8_

  - [x] 5.3 Implement board-generator module
    - Create `src/lib/board-generator.ts` with: `generateBoard(input: { seed: string; categoryIds: string[] }): Board`
    - Algorithm: collect pool from selected categories in order → seed Alea PRNG via `seedrandom` → Fisher-Yates shuffle → take first 25 → assign to 5×5 grid
    - Handle exact-25 case: use all items, shuffle for arrangement
    - Define types: `Board`, `Cell` interfaces
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 5.4 Write property tests for board-generator module
    - **Property 2: Board determinism and size** — Same seed + categories always produces identical 25-cell board.
    - **Validates: Requirements 5.1, 5.2, 5.4, 5.5**
    - **Property 3: Board items from selected categories** — Every cell text belongs to a selected category; no duplicates.
    - **Validates: Requirements 5.1, 5.4**
    - Create `src/lib/board-generator.prop.test.ts`
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

  - [x] 5.5 Implement bingo-detector module
    - Create `src/lib/bingo-detector.ts` with: `detectBingo(marks: CellMarks[]): BingoLine[]`
    - Check all 12 lines (5 rows, 5 columns, 2 diagonals)
    - A cell counts as marked if hostMarked OR guestMarked is true
    - Return array of completed lines (type, index)
    - _Requirements: 7.1, 7.3_

  - [x] 5.6 Write property tests for bingo-detector module
    - **Property 6: Bingo detection correctness** — Reports line complete iff all 5 cells in that line have hostMarked OR guestMarked true.
    - **Validates: Requirements 7.1, 7.3**
    - **Property 7: Unmarking can only reduce bingo lines** — Unmarking a cell in a complete line (making it fully unmarked) reduces or maintains bingo line count.
    - **Validates: Requirements 7.5, 7.6**
    - Create `src/lib/bingo-detector.prop.test.ts`
    - _Requirements: 7.1, 7.3, 7.5, 7.6_

  - [x] 5.7 Implement category data and types
    - Create `src/features/categories/data/categories.ts` with at least 3 predefined categories (Shot Speeds, Shot Types, Game Events), each with ≥10 items
    - Create `src/features/categories/types.ts` with `Category` and `CategoryItem` interfaces
    - Ensure unique IDs, names ≤30 chars, item text 1-40 chars, no duplicate text across categories, total ≥25 items
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 5.8 Write property tests for category data
    - **Property 8: Category selection count validation** — Total items equals sum of selected category item counts; confirm enabled iff total ≥25.
    - **Validates: Requirements 4.3, 4.4, 4.5**
    - **Property 9: Category data integrity** — At least 3 categories, unique IDs, name ≤30 chars, ≥10 items each, items 1-40 chars, unique text globally, total ≥25.
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.5, 11.6**
    - Create `src/features/categories/categories.prop.test.ts`
    - _Requirements: 4.3, 4.4, 4.5, 11.1, 11.2, 11.3, 11.5, 11.6_

- [x] 6. Checkpoint - Ensure pure modules and property tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Room creation and joining features
  - [x] 7.1 Implement room actions and queries
    - Create `src/features/rooms/actions.ts` with: `createRoom(params)`, `joinRoom(shareCode, guestId)`, `endGame(roomId)`
    - Create `src/features/rooms/queries.ts` with: `getRoomByShareCode(code)`, `getRoomById(id)`, `getActiveRoomForUser(userId)`
    - Create `src/features/rooms/schemas.ts` with Zod schemas for share code input validation and room creation params
    - Create `src/features/rooms/types.ts` with Room type re-exports
    - `createRoom`: generate seed (crypto.getRandomValues, 128-bit, base62 encoded), insert room with host_id, return roomId + shareCode
    - `joinRoom`: lookup by share_code, atomically set guest_id + status='active', return room
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8_

  - [x] 7.2 Implement useRoom hook
    - Create `src/features/rooms/hooks/useRoom.ts` with room state management
    - Handle: room creation flow, room joining flow, error states (invalid code, room unavailable, network error), loading states
    - Integrate with auth context for user ID
    - _Requirements: 2.4, 2.5, 2.6, 3.4, 3.5, 3.6, 3.7, 3.9_

  - [x] 7.3 Implement CategorySelector component
    - Create `src/features/categories/components/CategorySelector.tsx`
    - Display all categories as toggleable checkboxes with name and item count
    - Show running total of selected items, update within 100ms
    - Enable/disable confirm button based on ≥25 items threshold
    - Show message indicating how many more items needed when below 25
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 7.4 Implement CreateRoomPage and JoinRoomPage
    - Create `src/features/rooms/components/CreateRoomPage.tsx`: category selection → room creation → display share code/URL → waiting state
    - Create `src/features/rooms/components/ShareCodePanel.tsx`: copyable share code text + shareable URL
    - Create `src/features/rooms/components/JoinRoomPage.tsx`: share code input with validation → room lookup → join flow → navigate to game
    - Handle URL-based joining (extract code from hash route `/join/:code`)
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 7.5 Write unit tests for room actions and components
    - Test createRoom inserts correct fields
    - Test joinRoom handles various error states
    - Test CategorySelector toggle behavior and threshold logic
    - Test ShareCodePanel displays code and URL correctly
    - Test JoinRoomPage validation (empty, too long, invalid chars)
    - _Requirements: 2.1, 2.2, 3.2, 3.5, 3.6, 3.8, 4.3, 4.4, 4.5_

- [x] 8. Game board UI and marking
  - [x] 8.1 Implement game state reducer
    - Create `src/features/game/reducer.ts` with `gameReducer` handling: MARK_CELL, UNMARK_CELL, SET_BOARD, LOAD_MARKS, SET_CONNECTED, SET_LOADING, SET_ERROR, RESET
    - Mark/unmark logic: only affects the acting player's mark on a cell
    - Derive CellMarks from DB marks array
    - _Requirements: 6.1, 6.4, 6.5, 6.6_

  - [x] 8.2 Write property tests for game state reducer
    - **Property 4: Mark/unmark preserves other player's marks** — Marking by one player doesn't change the other player's mark state.
    - **Validates: Requirements 6.1, 6.5**
    - **Property 5: Mark and unmark actions are idempotent** — Re-marking an already-marked cell or un-marking an unmarked cell is a no-op.
    - **Validates: Requirements 8.5**
    - Create `src/features/game/reducer.prop.test.ts`
    - _Requirements: 6.1, 6.5, 8.5_

  - [x] 8.3 Implement useGameState hook
    - Create `src/features/game/hooks/useGameState.ts`
    - Load initial state from DB (room record + marks), generate board from seed/categories
    - Expose `markCell(cellIndex)` and `unmarkCell(cellIndex)` with optimistic updates
    - Persist marks to DB (INSERT for mark, DELETE for unmark) with retry logic (3 attempts, exponential backoff)
    - Handle error indicators on cells when persist fails
    - _Requirements: 6.1, 6.5, 6.7, 9.2, 9.3, 9.4, 9.5, 9.8_

  - [x] 8.4 Implement useMarks hook for DB sync
    - Create `src/features/game/hooks/useMarks.ts`
    - Functions: `insertMark(roomId, cellIndex, playerId)`, `deleteMark(roomId, cellIndex, playerId)`, `loadMarks(roomId)`
    - Create `src/features/game/queries.ts` with `getMarksForRoom(roomId)`
    - Implement `withRetry` utility in `src/lib/retry.ts` (3 attempts, 1s/2s/4s backoff)
    - _Requirements: 6.1, 6.5, 6.7, 9.2, 9.5, 9.8_

  - [x] 8.5 Implement BoardGrid and BingoCell components
    - Create `src/features/game/components/BoardGrid.tsx`: 5×5 CSS grid layout of BingoCell components
    - Create `src/features/game/components/BingoCell.tsx`: visually distinguish 4 states (unmarked, host-only, guest-only, both), click handler for mark/unmark
    - Style with Tailwind CSS, responsive design
    - _Requirements: 6.1, 6.4, 6.5, 6.6_

  - [x] 8.6 Implement useBingo hook and BingoNotification
    - Create `src/features/game/hooks/useBingo.ts`: run `detectBingo` on every marks change, track active bingo lines
    - Create `src/features/game/components/BingoNotification.tsx`: visible notification when lines detected, dismissed when no lines remain
    - Bingo does not lock the board — players can continue marking
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 8.7 Write unit tests for game board components
    - Test BoardGrid renders 25 cells in correct layout
    - Test BingoCell shows correct visual state for all 4 combinations
    - Test BingoNotification appears/disappears based on bingo state
    - _Requirements: 6.4, 6.6, 7.2, 7.5, 7.6_

- [x] 9. Checkpoint - Ensure game board works locally
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Realtime channel integration
  - [x] 10.1 Implement useRoomChannel hook
    - Create `src/features/rooms/hooks/useRoomChannel.ts`
    - Subscribe to `room:{roomId}` Broadcast channel
    - Handle events: `mark`, `unmark`, `player-joined`, `room-ended`
    - Track connection state: connecting, connected, disconnected, error
    - Implement reconnection logic: auto-retry 3 times (1s, 2s, 4s backoff)
    - Queue local actions during disconnection, broadcast on reconnection
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [x] 10.2 Integrate realtime with game state
    - Wire `useRoomChannel` into `useGameState` hook
    - On local mark/unmark: broadcast via channel AND persist to DB in parallel
    - On received broadcast: dispatch to game reducer (apply remote mark/unmark)
    - Handle idempotent actions (cell already in target state → no-op)
    - On `player-joined`: notify host, trigger board generation
    - On `room-ended`: transition to completed state
    - _Requirements: 6.2, 6.3, 8.1, 8.2, 8.5, 8.6_

  - [x] 10.3 Implement ConnectionStatus component
    - Create `src/features/game/components/ConnectionStatus.tsx`
    - Show connection state: connected (green), reconnecting (yellow), disconnected/error (red)
    - Display connection-lost banner within 3 seconds of disconnect
    - Show manual retry button when all retries exhausted
    - _Requirements: 8.4, 8.7_

  - [x] 10.4 Write unit tests for realtime integration
    - Test channel subscription lifecycle
    - Test message queuing during disconnection
    - Test reconnection retry logic
    - Test ConnectionStatus renders correct state for each phase
    - _Requirements: 8.1, 8.4, 8.7, 8.8_

- [x] 11. Game lifecycle and page reload recovery
  - [x] 11.1 Implement GamePage with state restoration
    - Create `src/features/game/components/GamePage.tsx`
    - On mount: identify room from URL (`/game/:roomId`), load room record + marks from DB, regenerate board, resubscribe to channel
    - Show loading indicator while restoring state
    - Show error + retry if DB read fails
    - _Requirements: 9.3, 9.4, 9.6, 9.7_

  - [x] 11.2 Implement end game flow
    - Add "End Game" button to GamePage (visible to Host only)
    - On click: update room status to "completed" in DB, broadcast `room-ended` event
    - On receiving `room-ended`: unsubscribe from channel, disable mark/unmark, show game-ended message
    - If room already completed/expired, show message and take no action
    - _Requirements: 12.1, 12.3, 12.4, 12.5, 12.6_

  - [x] 11.3 Implement completed/expired room view
    - When navigating to a room with status "completed" or "expired": show read-only board with final marks, game-ended message, and "Create New Room" button
    - Unsubscribe from realtime channel, disable all interactive elements
    - _Requirements: 12.3, 12.4, 12.5_

  - [x] 11.4 Write unit tests for game lifecycle
    - Test page reload restores board state correctly
    - Test end game flow updates status and broadcasts
    - Test completed room shows read-only view
    - Test loading indicator shown during restoration
    - _Requirements: 9.3, 9.7, 12.1, 12.3, 12.5_

- [x] 12. App routing and page wiring
  - [x] 12.1 Set up React Router v7 with hash routing
    - Create `src/app/router.tsx` with `createHashRouter`: `/` (HomePage), `/create` (CreateRoomPage), `/join/:code?` (JoinRoomPage), `/game/:roomId` (GamePage)
    - Create `src/app/App.tsx` wrapping router with providers (AuthProvider)
    - Update `src/main.tsx` to render the new App
    - Create `src/features/rooms/components/HomePage.tsx` with "Create Room" and "Join Room" buttons
    - _Requirements: 3.1, 3.2, 9.3_

  - [x] 12.2 Wire all pages together and verify navigation
    - Ensure CreateRoomPage navigates to GamePage after room creation and guest joins
    - Ensure JoinRoomPage navigates to GamePage after successful join
    - Ensure share URL (`/#/join/ABC123`) extracts code and auto-fills join form
    - Ensure GamePage loads correctly from direct URL navigation (page reload case)
    - _Requirements: 2.4, 2.5, 3.1, 3.4, 9.3_

- [x] 13. Checkpoint - Full game flow works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. UI polish and error handling
  - [x] 14.1 Implement loading states and error boundaries
    - Add loading spinners/skeletons for: auth initialization, room creation, room joining, board restoration
    - Add error boundary component for unhandled React errors
    - Implement toast/inline error messages for all failure scenarios defined in requirements
    - _Requirements: 1.5, 2.6, 3.5, 3.6, 3.7, 9.6, 9.7_

  - [x] 14.2 Implement mark error indicators and retry
    - Show error indicator on cells when persist fails after retries
    - Keep optimistic local state visible even on error
    - Offer per-cell or global retry for failed persists
    - _Requirements: 6.7, 9.8_

  - [x] 14.3 Polish responsive layout and visual design
    - Ensure board grid is responsive (works on mobile and desktop)
    - Style all pages with Tailwind + shadcn/ui components
    - Add visual feedback for cell interactions (hover, tap, transition states)
    - Ensure accessibility (keyboard navigation, ARIA labels on board cells, focus management)
    - _Requirements: 6.4 (visual states)_

- [x] 15. E2E testing setup
  - [x] 15.1 Configure Playwright for integration tests
    - Install and configure `@playwright/test`
    - Create `playwright.config.ts` with base URL pointing to local dev server
    - Create test helpers for Supabase auth (create test users, clean up)
    - Add npm script: `"test:e2e": "playwright test"`
    - _Requirements: N/A (test infrastructure)_

  - [x] 15.2 Write E2E tests for core game flow
    - Test: Host creates room → share code displayed
    - Test: Guest joins via share code → both see same board
    - Test: Mark cell → appears on both screens
    - Test: Bingo detection triggers notification
    - Test: End game → board becomes read-only
    - _Requirements: 2.4, 3.4, 6.2, 6.3, 7.2, 12.1_

  - [x] 15.3 Write RLS integration tests
    - Test: third user cannot read room data
    - Test: guest cannot update room config fields
    - Test: player cannot insert mark with another player's ID
    - Test: unauthenticated request is rejected
    - Run against local Supabase instance
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 10.7_

- [x] 16. Final checkpoint - All tests pass, app is ready
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The old PeerJS-based code is cleaned up in task 1.1 — all subsequent tasks assume the new architecture
- Database types (`src/database.types.ts`) should be regenerated after running migrations locally with `supabase gen types typescript --local`
- All realtime communication uses Supabase Broadcast (not Postgres Changes) for lower latency

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3"] },
    { "id": 1, "tasks": ["1.2", "1.4"] },
    { "id": 2, "tasks": ["2.1", "2.2", "5.7"] },
    { "id": 3, "tasks": ["2.3", "3.1", "5.1", "5.3", "5.5"] },
    { "id": 4, "tasks": ["3.2", "5.2", "5.4", "5.6", "5.8"] },
    { "id": 5, "tasks": ["3.3", "7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3"] },
    { "id": 7, "tasks": ["7.4", "8.1"] },
    { "id": 8, "tasks": ["7.5", "8.2", "8.3", "8.4"] },
    { "id": 9, "tasks": ["8.5", "8.6"] },
    { "id": 10, "tasks": ["8.7", "10.1"] },
    { "id": 11, "tasks": ["10.2", "10.3"] },
    { "id": 12, "tasks": ["10.4", "11.1", "12.1"] },
    { "id": 13, "tasks": ["11.2", "11.3", "12.2"] },
    { "id": 14, "tasks": ["11.4", "14.1", "14.2", "14.3"] },
    { "id": 15, "tasks": ["15.1"] },
    { "id": 16, "tasks": ["15.2", "15.3"] }
  ]
}
```
