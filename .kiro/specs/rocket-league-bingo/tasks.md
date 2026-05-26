# Implementation Plan: Rocket League Bingo

## Overview

This plan implements a client-side React SPA for two-player Rocket League Bingo with real-time peer-to-peer synchronization via PeerJS, deterministic board generation using seeded PRNG, and GitHub Pages deployment. The implementation uses Vite + React + TypeScript with hash-based routing.

## Tasks

- [ ] 1. Project scaffolding and core setup
  - [x] 1.1 Initialize Vite + React + TypeScript project
    - Run `npm create vite@latest . -- --template react-ts`
    - Install dependencies: `react-router-dom`, `seedrandom`, `peerjs`
    - Install dev dependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@fast-check/vitest`, `gh-pages`
    - Configure `vite.config.ts` with `base: '/rocket-league-bingo/'` and `server: { port: 5174 }`
    - Configure `vitest` in `vite.config.ts` with `environment: 'jsdom'`
    - Set up `tsconfig.json` with strict mode
    - _Requirements: 10.1, 10.5, 10.6_

  - [x] 1.2 Set up hash router and route structure
    - Create `src/App.tsx` with `createHashRouter` and `RouterProvider`
    - Define routes: `/` (HomePage), `/create` (CreateRoomPage), `/join/:code?` (JoinRoomPage), `/game` (GamePage)
    - Create placeholder components for each page
    - _Requirements: 10.1, 10.6_

- [ ] 2. Core data models and types
  - [x] 2.1 Define TypeScript interfaces and types
    - Create `src/types/index.ts` with all core types: `PlayerRole`, `Cell`, `Board`, `CellMarks`, `GameState`, `BingoLine`, `PersistedState`, `Category`, `GameMessage`, `GameAction`
    - Ensure types match the design document interfaces exactly
    - _Requirements: 4.1, 5.4, 6.1_

- [ ] 3. Predefined categories data
  - [x] 3.1 Create category data module
    - Create `src/data/categories.ts` with at least 3 predefined categories (Shot Speeds, Shot Types, and at least one additional)
    - Each category must have a unique `id`, `name`, and at least 10 items
    - Each item text must be ≤40 characters and unique within its category
    - Total items across all categories must be ≥25
    - Export a `getCategory(id: string)` helper and `allCategories` array
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 3.2 Write property test for category data integrity
    - **Property 9: Category data integrity**
    - Verify each category has unique name, ≥10 items, items ≤40 chars, no duplicates within category
    - **Validates: Requirements 9.2, 9.3**

- [ ] 4. Seeded board generation
  - [x] 4.1 Implement board generator module
    - Create `src/logic/boardGenerator.ts`
    - Import `seedrandom` and use `seedrandom.alea(seed)` for the PRNG
    - Implement Fisher-Yates shuffle with seeded PRNG
    - Implement `generateBoard(input: { seed: string; categoryIds: string[] }): Board`
    - Collect items from selected categories, shuffle with seeded PRNG, take first 25
    - _Requirements: 4.1, 4.2, 4.4, 4.5_

  - [x] 4.2 Write property tests for board generation
    - **Property 2: Board generation determinism and size**
    - Verify same seed + categories always produces identical 25-cell board
    - **Property 3: Board items from selected categories only**
    - Verify all cells belong to selected categories and no duplicates
    - **Validates: Requirements 4.1, 4.2, 4.4, 4.5**

- [ ] 5. Share code encoding/decoding
  - [x] 5.1 Implement share code codec
    - Create `src/logic/shareCodeCodec.ts`
    - Implement base62 encoding/decoding utilities
    - Implement `encodeShareCode(data: ShareCodeData): string` — encode seed (22 base62 chars) + category bitmask (1-2 base62 chars)
    - Implement `decodeShareCode(code: string): ShareCodeData | null`
    - Implement `buildShareUrl(code: string): string` and `parseShareUrl(url: string): ShareCodeData | null`
    - Ensure share code is ≤32 characters
    - Derive PeerJS peer ID as `rlb-${seedBase62}`
    - _Requirements: 1.2, 2.1_

  - [x] 5.2 Write property test for share code round-trip
    - **Property 1: Share code round-trip**
    - Verify encoding then decoding produces original seed and categories, code ≤32 chars
    - **Validates: Requirements 1.2, 2.1**

- [ ] 6. Game state reducer
  - [x] 6.1 Implement game state reducer
    - Create `src/logic/gameStateReducer.ts`
    - Implement `gameStateReducer(state: GameState, action: GameAction): GameState`
    - Handle actions: `MARK_CELL`, `UNMARK_CELL`, `SET_BOARD`, `SYNC_STATE`, `RESET`
    - Marking a cell by one player must not affect the other player's mark
    - Mark/unmark actions must be idempotent
    - _Requirements: 5.1, 5.3, 5.5, 7.5, 7.6_

  - [x] 6.2 Write property tests for game state reducer
    - **Property 4: Mark/unmark preserves other player's marks**
    - Verify marking by one player does not affect the other player's mark state
    - **Property 5: Mark and unmark actions are idempotent**
    - Verify applying same action twice produces same state
    - **Validates: Requirements 5.1, 5.3, 5.5, 7.5**

- [ ] 7. Bingo detection logic
  - [x] 7.1 Implement bingo detector
    - Create `src/logic/bingoDetector.ts`
    - Implement `detectBingo(marks: CellMarks[]): BingoLine[]`
    - Check all 5 rows, 5 columns, and 2 diagonals
    - A line is complete when all 5 cells are marked by at least one player (union of both marks)
    - Return array of all detected bingo lines
    - _Requirements: 6.1, 6.3_

  - [x] 7.2 Write property tests for bingo detection
    - **Property 6: Bingo detection correctness**
    - Verify bingo detected iff complete line exists (union of both players' marks)
    - **Property 7: Unmarking a cell in a bingo line removes that bingo**
    - Verify unmarking breaks the bingo line detection
    - **Validates: Requirements 6.1, 6.3, 6.5**

- [ ] 8. localStorage persistence adapter
  - [x] 8.1 Implement persistence adapter
    - Create `src/logic/persistenceAdapter.ts`
    - Implement `saveGameState(state: PersistedState): void` — serialize to JSON and store in localStorage
    - Implement `loadGameState(): PersistedState | null` — parse from localStorage with schema validation, return null on failure
    - Implement `clearGameState(): void` — remove persisted state
    - Handle `QuotaExceededError` gracefully (log warning, continue without saves)
    - Handle corrupted JSON gracefully (clear data, return null)
    - _Requirements: 8.1, 8.2, 8.5, 8.6, 8.7_

  - [x] 8.2 Write property test for persistence round-trip
    - **Property 8: Game state persistence round-trip**
    - Verify saving then loading produces equivalent game state
    - **Validates: Requirements 8.2, 8.5**

- [x] 9. Checkpoint - Core logic complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. PeerJS connection manager
  - [x] 10.1 Implement connection manager
    - Create `src/network/connectionManager.ts`
    - Implement `createRoom(): Promise<{ peerId: string }>` — create Peer with deterministic ID `rlb-${seedBase62}`, wait for `open` event with 10s timeout
    - Implement `joinRoom(peerId: string): Promise<void>` — connect to host peer with 15s timeout
    - Implement `send(message: GameMessage): void` — send via DataChannel
    - Implement `onMessage`, `onConnect`, `onDisconnect` handlers
    - Implement `disconnect()` and `isConnected()` methods
    - Handle errors: `peer-unavailable`, `server-error`, `network`
    - Implement reconnection with exponential backoff (1s, 2s, 4s) up to 3 retries
    - Handle room-full rejection (host sends REJECT message)
    - _Requirements: 1.4, 1.5, 2.3, 2.5, 2.6, 7.1, 7.3, 7.4, 8.3_

  - [x] 10.2 Write unit tests for connection manager
    - Mock PeerJS `Peer` constructor and events
    - Test connection establishment, timeout handling, error scenarios
    - Test reconnection with exponential backoff
    - Test room-full rejection flow
    - _Requirements: 1.4, 1.5, 2.5, 2.6, 7.4, 8.3_

- [ ] 11. React Context and game provider
  - [x] 11.1 Create GameContext and GameProvider
    - Create `src/context/GameContext.tsx`
    - Wrap `useReducer` with `gameStateReducer`
    - Integrate `connectionManager` for sending/receiving messages
    - Integrate `persistenceAdapter` for auto-saving state changes
    - Integrate `bingoDetector` to update bingo lines on mark changes
    - Provide actions: `markCell`, `unmarkCell`, `createRoom`, `joinRoom`, `resetGame`
    - Handle incoming messages: apply remote marks, handle SYNC_REQUEST/SYNC_RESPONSE
    - Persist state within 1 second of changes (debounced)
    - _Requirements: 5.2, 5.3, 7.1, 7.2, 8.1_

- [ ] 12. React components - Pages
  - [x] 12.1 Implement HomePage component
    - Create `src/pages/HomePage.tsx`
    - Display "Create Room" and "Join Room" buttons/links
    - Check localStorage for existing game state and offer resume option
    - Navigate to `/create` or `/join` routes
    - _Requirements: 1.1, 2.2_

  - [x] 12.2 Implement CreateRoomPage component
    - Create `src/pages/CreateRoomPage.tsx`
    - Generate seed using `crypto.getRandomValues` (128-bit)
    - Include `CategorySelector` component for category selection
    - After category confirmation: initialize PeerJS connection, generate share code
    - Display share code and shareable URL (ShareCodePanel)
    - Show waiting state indicator while waiting for Guest
    - On Guest connection: navigate to `/game`
    - Handle connection initialization errors with retry option
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.5_

  - [x] 12.3 Implement JoinRoomPage component
    - Create `src/pages/JoinRoomPage.tsx`
    - If `:code` param present, auto-extract and initiate connection
    - Otherwise show text input for manual share code entry
    - Decode share code, derive peer ID, connect to host
    - Handle errors: invalid code, host unreachable (15s timeout), room full
    - On successful connection: receive seed + categories, generate board, navigate to `/game`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 12.4 Implement GamePage component
    - Create `src/pages/GamePage.tsx`
    - Render `BoardGrid`, `ConnectionStatus`, and `BingoNotification` components
    - Subscribe to GameContext for board state and bingo lines
    - Handle page reload: restore from localStorage, attempt reconnection
    - _Requirements: 4.1, 5.1, 6.2, 8.2, 8.3_

- [ ] 13. React components - Board and cells
  - [x] 13.1 Implement BoardGrid and BingoCell components
    - Create `src/components/BoardGrid.tsx` — render 5×5 CSS grid of BingoCell components
    - Create `src/components/BingoCell.tsx` — render individual cell with four visual states
    - Visual states: unmarked, marked-by-host, marked-by-guest, marked-by-both (distinct CSS classes)
    - On cell click: dispatch mark/unmark action through GameContext
    - Highlight cells that are part of a bingo line
    - _Requirements: 5.1, 5.4, 5.5, 5.6, 6.4_

  - [x] 13.2 Implement CategorySelector component
    - Create `src/components/CategorySelector.tsx`
    - Display all categories with name and item count
    - Toggle entire categories on/off
    - Show real-time total of selected items
    - Disable confirm button when total < 25, show helper text indicating items needed
    - Enable confirm button when total ≥ 25
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

  - [x] 13.3 Write property test for category selection validation
    - **Property 10: Category selection item count validation**
    - Verify total count equals sum of selected category items, confirm enabled iff total ≥ 25
    - **Validates: Requirements 3.3, 3.4, 3.6**

  - [x] 13.4 Implement ConnectionStatus and BingoNotification components
    - Create `src/components/ConnectionStatus.tsx` — show connected/disconnected/reconnecting states with visual indicator
    - Create `src/components/BingoNotification.tsx` — show bingo alert when detected, dismiss when bingo line broken
    - ConnectionStatus must show disconnection within 3 seconds of detection
    - _Requirements: 6.2, 6.5, 7.4_

- [x] 14. Checkpoint - UI components complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Real-time synchronization integration
  - [x] 15.1 Wire synchronization into GameProvider
    - Ensure mark/unmark actions are transmitted within 100ms of local state change
    - Ensure received actions are applied to local state and UI within 100ms
    - Implement SYNC_REQUEST/SYNC_RESPONSE for reconnection state merge
    - Handle idempotent actions (received action for cell already in target state)
    - Handle simultaneous conflicting actions (last-write-wins)
    - Queue actions during disconnection, send on reconnect
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 8.4_

  - [x] 15.2 Write integration tests for synchronization
    - Test mark action transmission and receipt flow (mock DataChannel)
    - Test reconnection sync request/response
    - Test idempotent action handling
    - Test queued actions sent on reconnect
    - _Requirements: 7.1, 7.2, 7.5, 8.4_

- [ ] 16. State persistence integration
  - [x] 16.1 Wire persistence into game lifecycle
    - Auto-save game state to localStorage within 1 second of board state changes (debounced)
    - On page load: check localStorage, restore state if valid
    - On restore: attempt DataChannel reconnection with stored peer info (10s timeout, 3 retries)
    - On new game creation: clear previously persisted state
    - Handle corrupted localStorage gracefully (discard, show home screen)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 17. Checkpoint - Full feature integration complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. GitHub Pages deployment configuration
  - [x] 18.1 Configure deployment pipeline
    - Verify `vite.config.ts` has `base: '/rocket-league-bingo/'`
    - Add `homepage` field to `package.json`
    - Add `predeploy` and `deploy` scripts using `gh-pages -d dist`
    - Create `.github/workflows/deploy.yml` GitHub Actions workflow
    - Workflow: on push to main → install deps → build → deploy dist to gh-pages branch
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 19. Final checkpoint - All tests pass and app is deployable
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. End-to-end testing with Playwright MCP server
  - [x] 20.1 Test application UI flows with Playwright MCP
    - Start the dev server on port 5174 (`npm run dev -- --port 5174`) and use the Playwright MCP browser tools to verify the app at `http://localhost:5174/rocket-league-bingo/`
    - Navigate to the home page and verify "Create Room" and "Join Room" buttons render
    - Test the Create Room flow: navigate to `/create`, verify category selector displays, select categories, confirm selection, verify share code is displayed
    - Test the Join Room flow: navigate to `/join`, verify text input for share code is present
    - Test the Game Board: verify 5×5 grid renders with correct cell content
    - Test cell marking: click cells and verify visual state changes (unmarked → marked)
    - Verify bingo notification appears when a line is completed
    - Verify responsive layout and accessibility of key interactive elements
    - _Requirements: 1.1, 2.2, 3.1, 4.1, 5.1, 6.2_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all implementation tasks use TypeScript
- PeerJS uses its free cloud signaling server by default (no custom server needed)
- Hash-based routing (`createHashRouter`) eliminates GitHub Pages 404.html workarounds

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["3.1", "4.1", "5.1", "6.1", "7.1", "8.1"] },
    { "id": 3, "tasks": ["3.2", "4.2", "5.2", "6.2", "7.2", "8.2"] },
    { "id": 4, "tasks": ["10.1"] },
    { "id": 5, "tasks": ["10.2", "11.1"] },
    { "id": 6, "tasks": ["12.1", "12.2", "12.3", "12.4"] },
    { "id": 7, "tasks": ["13.1", "13.2", "13.4"] },
    { "id": 8, "tasks": ["13.3", "15.1", "16.1"] },
    { "id": 9, "tasks": ["15.2", "18.1"] },
    { "id": 10, "tasks": ["20.1"] }
  ]
}
```
