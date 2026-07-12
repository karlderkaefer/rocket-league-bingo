# Requirements Document

## Introduction

Rocket League Bingo is a two-player web application where players compete using a shared bingo board populated with Rocket League game events. This specification covers the rebuild of the application from a PeerJS/WebRTC + localStorage architecture to a Supabase-backed architecture. The frontend remains a React + Vite + TypeScript SPA, but all persistence, authentication, and real-time synchronization are handled by Supabase (Postgres database, Supabase Auth, and Supabase Realtime).

The core gameplay is unchanged: a Host creates a room, selects categories, a Guest joins via a share code/link, both see an identical 5×5 bingo board generated deterministically from a seed, and players mark cells in real time as Rocket League events occur. Bingo is detected when a full row, column, or diagonal is completed.

## Glossary

- **App**: The Rocket League Bingo single-page React application
- **Player**: A human user interacting with the App; exactly two Players participate in a session
- **Host**: The Player who creates a Room and initiates the game session
- **Guest**: The Player who joins an existing Room using a Share_Code or link
- **Room**: A database record representing a game session, linking two Players
- **Board**: A 5×5 bingo grid of Cells generated deterministically from a Seed
- **Cell**: A single square on the Board containing a Category_Item
- **Category**: A predefined grouping of related bingo items (e.g., Shot Speeds, Shot Types)
- **Category_Item**: A specific entry within a Category (e.g., "Shot over 100 km/h", "Aerial Goal")
- **Seed**: A deterministic string value used to generate a reproducible Board layout
- **Share_Code**: A compact string encoding the Room identifier, shareable as text or URL
- **Supabase_Client**: The Supabase JavaScript client library used for auth, database, and realtime operations
- **Realtime_Channel**: A Supabase Realtime channel used to broadcast and receive game actions between Players
- **RLS**: Row Level Security — Postgres policies that restrict data access based on the authenticated user
- **Anonymous_Auth**: Supabase authentication method that creates a user identity without requiring credentials

## Requirements

### Requirement 1: Authentication

**User Story:** As a Player, I want to have an identity when I use the app, so that the system can track my game sessions and enforce access control.

#### Acceptance Criteria

1. WHEN a Player opens the App without an existing session, THE App SHALL automatically sign the Player in using Supabase Anonymous Auth within 10 seconds
2. WHEN a Player is signed in anonymously, THE App SHALL persist the auth session so that subsequent page loads reuse the same identity
3. WHERE social login is enabled, THE App SHALL allow the Player to sign in with a supported OAuth provider (e.g., Google, Discord)
4. WHEN a Player signs in with an OAuth provider while already signed in anonymously, THE App SHALL link the anonymous identity to the OAuth identity preserving existing game data
5. IF the Supabase authentication service is unreachable or the anonymous sign-in request fails within 10 seconds, THEN THE App SHALL display an error message indicating the service is unavailable, offer a retry option, and prevent Room creation or joining
6. IF linking the anonymous identity to the OAuth identity fails, THEN THE App SHALL display an error message indicating the linking failed, preserve the existing anonymous session, and allow the Player to retry or continue as anonymous

### Requirement 2: Room Creation

**User Story:** As a Host, I want to create a new game room, so that I can start a bingo session and invite another Player.

#### Acceptance Criteria

1. WHEN the Host selects "Create Room", THE App SHALL generate a Seed using a cryptographically random value of at least 128 bits to ensure practical uniqueness across sessions
2. WHEN a Room is created, THE App SHALL insert a Room record into the Supabase database containing the Seed, selected category identifiers, Host user ID, and a status of "waiting"
3. WHEN a Room is created, THE App SHALL generate a Share_Code of no more than 8 characters derived from the Room record identifier
4. WHEN a Room is created, THE App SHALL display the Share_Code as copyable text and a shareable URL containing the Share_Code to the Host within 2 seconds of Room creation
5. WHEN a Room is created, THE App SHALL subscribe to the Room's Realtime_Channel and wait for the Guest to join, displaying a waiting state indicator
6. IF the Room record fails to insert into the database, THEN THE App SHALL display an error message indicating Room creation failed and allow the Host to retry without navigating away from the creation screen
7. IF the Host selects "Create Room" before confirming a category selection with at least 25 total Category_Items, THEN THE App SHALL prevent Room creation and display a message indicating that categories must be selected first

### Requirement 3: Room Joining

**User Story:** As a Guest, I want to join an existing room using a share code or link, so that I can play bingo with the Host.

#### Acceptance Criteria

1. WHEN the Guest opens a shareable URL, THE App SHALL extract the Share_Code from the URL and initiate the join flow by looking up the corresponding Room record in the Supabase database
2. WHEN the Guest manually enters a Share_Code of 1 to 8 alphanumeric characters and submits, THE App SHALL look up the corresponding Room record in the Supabase database
3. WHEN a valid Room with status "waiting" is found, THE App SHALL atomically update the Room record to set the Guest user ID and change the status to "active", such that only one Guest can successfully claim the Room
4. WHEN the Guest successfully joins a Room, THE App SHALL subscribe to the Room's Realtime_Channel and generate the Board from the Room's Seed and category selection
5. IF the Guest provides a Share_Code that does not match any Room record, THEN THE App SHALL display an error message indicating the code is invalid
6. IF the Room status is "active", "completed", or "expired", THEN THE App SHALL display an error message indicating the Room is unavailable and offer the Guest the option to create a new Room or enter a different Share_Code
7. IF the Room lookup or update fails due to a network error, THEN THE App SHALL display an error message and allow the Guest to retry the operation without re-entering the Share_Code
8. IF the Guest submits input that is empty or exceeds 8 characters, THEN THE App SHALL display a validation error without making a database request
9. IF the Realtime_Channel subscription fails after joining the Room, THEN THE App SHALL display a connection error message and attempt to resubscribe, allowing the Guest to retry

### Requirement 4: Category Selection

**User Story:** As a Host, I want to select which categories to include on the bingo board, so that the game is customized to the events we want to track.

#### Acceptance Criteria

1. WHEN the Host is configuring a new game, THE App SHALL display all available Categories as selectable checkboxes, each showing the Category name and the count of Category_Items it contains, with no Categories selected by default
2. THE App SHALL operate category selection at the Category level, selecting or deselecting entire Categories at a time via a single toggle per Category
3. WHEN the Host toggles a Category, THE App SHALL update the displayed total of selected Category_Items within 100 milliseconds of the toggle action
4. IF the total selected Category_Items is fewer than 25, THEN THE App SHALL disable the confirm button and display a message indicating how many more items are needed to reach 25
5. IF the total selected Category_Items is 25 or greater, THEN THE App SHALL enable the confirm button
6. WHEN the Host confirms the category selection, THE App SHALL include the selected Category identifiers in the Room record stored in the database

### Requirement 5: Deterministic Board Generation

**User Story:** As a Player, I want both Players to see the same bingo board, so that we are playing the same game.

#### Acceptance Criteria

1. WHEN a Seed and category selection are provided, THE App SHALL generate a 5×5 Board by deterministically selecting exactly 25 unique Category_Items from the pool of all items in the selected Categories and arranging them into fixed Cell positions, where the pool is constructed by iterating the selected Categories in their provided order
2. THE App SHALL produce an identical Board layout for any two executions given the same Seed and the same ordered category selection, regardless of browser, operating system, or device
3. WHEN the Guest joins a Room, THE App SHALL read the Seed and category selection from the Room database record and generate the Board locally using the same algorithm without requiring the full Board layout to be stored in the database
4. IF the pool of available Category_Items from the selected Categories exceeds 25, THEN THE App SHALL use the Seed to deterministically select which 25 items to include, ensuring no Category_Item appears more than once on the Board
5. THE App SHALL use a seeded pseudo-random number generator so that Board generation is reproducible and platform-independent given identical inputs
6. IF the pool of available Category_Items from the selected Categories equals exactly 25, THEN THE App SHALL use all 25 items and use the Seed only to determine their arrangement on the Board

### Requirement 6: Cell Marking

**User Story:** As a Player, I want to mark cells on the bingo board when a Rocket League event occurs, so that I can track progress toward bingo.

#### Acceptance Criteria

1. WHEN a Player selects an unmarked Cell, THE App SHALL mark that Cell as completed by that Player on the local Board and persist the mark to the Supabase database
2. WHEN a Player marks a Cell, THE App SHALL broadcast the mark action including the Cell index and Player identity via the Realtime_Channel
3. WHEN a mark action is received from the Realtime_Channel, THE App SHALL update the corresponding Cell on the local Board
4. THE App SHALL visually distinguish between four Cell states: unmarked, marked by Host only, marked by Guest only, and marked by both Players
5. WHEN a Player selects a Cell that they have previously marked, THE App SHALL remove only that Player's mark from the Cell, persist the change to the database, and broadcast the unmark action via the Realtime_Channel
6. WHEN both Players have independently marked the same Cell, THE App SHALL display that Cell in the marked-by-both state
7. IF the database persist fails when marking or unmarking a Cell, THEN THE App SHALL display an error indicator on the affected Cell, keep the optimistic local state, and retry the persist operation up to 3 times with exponential backoff

### Requirement 7: Bingo Detection

**User Story:** As a Player, I want the app to detect when bingo is achieved, so that the game outcome is clear.

#### Acceptance Criteria

1. WHEN a Cell is marked or unmarked, THE App SHALL check all 12 possible lines (5 rows, 5 columns, and 2 diagonals) on the Board and determine which lines have all 5 Cells marked by at least one Player
2. WHEN at least one complete line is detected, THE App SHALL display a visible bingo notification to the Player that remains on screen as long as at least one complete line exists
3. THE App SHALL evaluate bingo based on the union of all marked Cells regardless of which Player marked them, counting a Cell as marked if either the Host or the Guest has marked it
4. WHEN bingo is detected, THE App SHALL allow Players to continue marking and unmarking Cells without locking the Board
5. IF an unmark action breaks a previously completed line but at least one other complete line still exists, THEN THE App SHALL keep the bingo notification displayed
6. IF an unmark action results in no complete lines remaining on the Board, THEN THE App SHALL dismiss the bingo notification
7. THE App SHALL independently detect bingo on each Player's client from its own locally synchronized Board state without requiring a bingo message from the other Player

### Requirement 8: Real-Time Synchronization via Supabase Realtime

**User Story:** As a Player, I want board changes to appear instantly on both screens, so that the game feels responsive and synchronized.

#### Acceptance Criteria

1. WHEN a Player performs a mark or unmark action, THE App SHALL broadcast the action via the Supabase Realtime_Channel associated with the Room within 500 milliseconds of the local state change
2. WHEN an action is received via the Realtime_Channel, THE App SHALL apply it to the local Board state and update the UI within 500 milliseconds of receipt
3. WHILE the Realtime_Channel is subscribed, THE App SHALL maintain a persistent WebSocket connection to Supabase without polling
4. IF the Realtime_Channel disconnects unexpectedly, THEN THE App SHALL display a connection-lost indicator to the Player within 3 seconds of the disconnect event and attempt to resubscribe up to 3 times with exponential backoff delays of 1 second, 2 seconds, and 4 seconds
5. IF a received action references a Cell that is already in the target state, THEN THE App SHALL treat the action as idempotent and not alter the Cell state
6. WHEN both Players perform actions on the same Cell before either action is confirmed by a broadcast, THE App SHALL resolve to a consistent state by applying the database record as the source of truth and reconciling local state on the next received broadcast
7. IF all resubscribe attempts are exhausted after a Realtime_Channel disconnection, THEN THE App SHALL display a persistent error message indicating the connection could not be restored and offer a manual retry option
8. WHILE the Realtime_Channel is disconnected, THE App SHALL queue any local mark or unmark actions and broadcast them upon successful resubscription

### Requirement 9: Database Persistence

**User Story:** As a Player, I want my game state stored in the database, so that I do not lose progress if I reload the page or switch devices.

#### Acceptance Criteria

1. WHEN a Room is created, THE App SHALL store the Room record (Seed, category selection, Host ID, status, Share_Code) in the Supabase database
2. WHEN a Player marks or unmarks a Cell, THE App SHALL persist the mark state to the Supabase database within 2 seconds of the local state change
3. WHEN a Player reloads the page with an active Room, THE App SHALL identify the active Room from the URL or locally stored Room ID, read the Room record and all marks from the database, and restore the Board state
4. WHEN a Player reloads the page, THE App SHALL resubscribe to the Room's Realtime_Channel to resume receiving live updates
5. THE App SHALL store marks with attribution to the Player who made them (Host or Guest) using the authenticated user ID
6. IF the database read fails on page reload, THEN THE App SHALL display an error message and offer a retry option
7. WHILE the Board state is being restored from the database, THE App SHALL display a loading indicator to the Player
8. IF a database write fails when persisting a mark, THEN THE App SHALL retry the write up to 3 times and display an error indicator if all retries fail

### Requirement 10: Row Level Security

**User Story:** As a Player, I want my game data to be private, so that other players cannot access or modify my game sessions.

#### Acceptance Criteria

1. THE Supabase database SHALL enforce RLS policies so that only the Host and Guest of a Room can read that Room's full record and associated marks data
2. THE Supabase database SHALL enforce RLS policies so that only the Host can update Room configuration fields (category selection) and set the Room status to "completed"
3. THE Supabase database SHALL enforce RLS policies so that a Player can only insert or update marks attributed to their own identity
4. WHEN an authenticated user queries a Room record by Share_Code and the Room status is "waiting", THE Supabase database SHALL allow read access to the Room identifier, Share_Code, and status fields only
5. IF an unauthenticated request attempts to access Room data, THEN THE Supabase database SHALL reject the request and return an authorization error
6. WHEN an authenticated user joins a Room with status "waiting" and no Guest is assigned, THE Supabase database SHALL allow that user to set themselves as the Guest and update the Room status to "active"
7. IF an authenticated user who is neither the Host nor the Guest of a Room attempts to modify that Room's data or marks, THEN THE Supabase database SHALL reject the write operation

### Requirement 11: Predefined Categories

**User Story:** As a Player, I want categories to be built into the application, so that I can start playing without manual setup.

#### Acceptance Criteria

1. THE App SHALL include at least three predefined Categories (Shot Speeds, Shot Types, and Game Events)
2. THE App SHALL define each Category with a unique identifier, a name of no more than 30 characters, and a list of Category_Items where each Category_Item text is unique within its Category
3. THE App SHALL include at least 10 Category_Items per Category, each represented as a text string between 1 and 40 characters in length
4. WHEN the App loads, THE App SHALL make all predefined Categories available for selection without external data fetching
5. THE App SHALL ensure the total number of Category_Items across all predefined Categories is at least 25
6. THE App SHALL ensure that no two Category_Items across all predefined Categories share the same text value, so that each Cell on the Board is uniquely identifiable by its text

### Requirement 12: Room Lifecycle Management

**User Story:** As a Player, I want rooms to be cleaned up when they are no longer in use, so that stale data does not accumulate.

#### Acceptance Criteria

1. WHEN the Host selects the "End Game" action from the active game screen, THE App SHALL update the Room status to "completed" in the database and broadcast a room-ended event via the Realtime_Channel to the Guest
2. WHEN a Room has had no mark or unmark action persisted to the database for more than 24 hours and its status is "active", THE Supabase database SHALL allow a scheduled process to update the Room status to "expired"
3. WHEN a Player navigates to a Room that has status "completed" or "expired", THE App SHALL display a read-only view of the final Board state, a message indicating the game has ended, and a button to create a new Room
4. THE App SHALL not delete Room records, preserving game history for both Players
5. WHEN the Room status changes to "completed" or "expired", THE App SHALL unsubscribe from the Room's Realtime_Channel and disable all mark and unmark actions on the Board
6. IF the Host attempts to end a game for a Room whose status is already "completed" or "expired", THEN THE App SHALL display a message indicating the game has already ended and take no further action
