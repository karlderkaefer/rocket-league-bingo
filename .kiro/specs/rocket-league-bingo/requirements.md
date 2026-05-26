# Requirements Document

## Introduction

Rocket League Bingo is a static two-player web application hosted on GitHub Pages. Two players create a shared bingo board seeded from predefined Rocket League categories (shot speeds, shot types, etc.), then play together in real time via peer-to-peer communication. The application uses no backend; WebRTC (via PeerJS) handles live synchronization, and localStorage provides reload resilience.

## Glossary

- **App**: The Rocket League Bingo single-page React application hosted on GitHub Pages
- **Player**: A human user interacting with the App; exactly two Players participate in a session
- **Host**: The Player who creates a room and initiates the game session
- **Guest**: The Player who joins an existing room using a share code or link
- **Room**: A logical pairing of two Players connected via a WebRTC DataChannel
- **Board**: A 5×5 bingo grid of Cells generated deterministically from a Seed
- **Cell**: A single square on the Board containing a Category Item
- **Category**: A predefined grouping of related bingo items (e.g., Shot Speeds, Shot Types)
- **Category_Item**: A specific entry within a Category (e.g., "100+ km/h shot", "Aerial Goal")
- **Seed**: A deterministic value used to generate a reproducible Board layout
- **Share_Code**: A compact string encoding the Room connection information, shareable as text or URL
- **DataChannel**: A WebRTC peer-to-peer data connection used to exchange game actions between Players
- **PeerJS**: A JavaScript library that handles WebRTC signaling and connection establishment
- **localStorage**: Browser-provided key-value storage used to persist game state across page reloads

## Requirements

### Requirement 1: Room Creation

**User Story:** As a Host, I want to create a new game room, so that I can start a bingo session and invite another Player.

#### Acceptance Criteria

1. WHEN the Host selects "Create Room", THE App SHALL generate a Seed using a cryptographically random value of at least 128 bits to ensure practical uniqueness across sessions
2. WHEN a Room is created, THE App SHALL generate a Share_Code no longer than 32 characters that encodes the PeerJS peer ID and the Seed
3. WHEN a Room is created, THE App SHALL display the Share_Code and a shareable URL to the Host
4. WHEN a Room is created, THE App SHALL initialize a PeerJS peer connection and wait for the Guest to connect, displaying a waiting state indicator to the Host
5. IF the PeerJS peer connection fails to initialize within 10 seconds, THEN THE App SHALL display an error message indicating the connection could not be established and allow the Host to retry

### Requirement 2: Room Joining

**User Story:** As a Guest, I want to join an existing room using a share code or link, so that I can play bingo with the Host.

#### Acceptance Criteria

1. WHEN the Guest opens a shareable URL, THE App SHALL extract the Share_Code from the URL and initiate a connection to the Host
2. WHEN the Guest manually enters a Share_Code, THE App SHALL initiate a connection to the Host
3. WHEN the Guest successfully establishes a DataChannel with the Host, THE App SHALL receive the Seed and category selection from the Host and display the Board
4. IF the Guest provides an invalid or expired Share_Code, THEN THE App SHALL display an error message indicating the Share_Code is invalid or expired
5. IF the connection to the Host is not established within 15 seconds, THEN THE App SHALL display an error message indicating the Host is unreachable
6. IF the Room already has a connected Guest, THEN THE App SHALL display an error message indicating the Room is full and reject the connection

### Requirement 3: Category Selection

**User Story:** As a Host, I want to select which categories to include on the bingo board, so that the game is customized to the categories we want to play.

#### Acceptance Criteria

1. WHEN the Host is configuring a new game, THE App SHALL display all available Categories as selectable items, each showing the Category name and the count of Category_Items it contains
2. THE App SHALL operate category selection at the Category level, selecting or deselecting entire Categories at a time
3. THE App SHALL display a real-time count of the total selected Category_Items as the Host toggles Categories
4. THE App SHALL require the total selected Category_Items to be at least 25 before allowing the Host to confirm
5. WHEN the Host confirms the category selection, THE App SHALL include the selected Category identifiers as part of the Seed input for Board generation
6. IF the total selected Category_Items is fewer than 25, THEN THE App SHALL disable the confirm button and display a message indicating how many more items are needed

### Requirement 4: Deterministic Board Generation

**User Story:** As a Player, I want both Players to see the same bingo board, so that we are playing the same game.

#### Acceptance Criteria

1. WHEN a Seed and Category selection are provided, THE App SHALL generate a 5×5 Board by deterministically selecting exactly 25 Category_Items from the pool of all items in the selected Categories and arranging them into fixed Cell positions
2. THE App SHALL produce an identical Board layout for any two executions given the same Seed and the same Category selection
3. WHEN the Guest connects, THE App SHALL receive the Seed and Category selection from the Host via the DataChannel and generate the Board locally without requiring the Host to transmit the full Board layout
4. IF the pool of available Category_Items from the selected Categories exceeds 25, THEN THE App SHALL use the Seed to deterministically select which 25 items to include
5. THE App SHALL use a seeded pseudo-random number generator so that Board generation is reproducible and platform-independent given identical inputs

### Requirement 5: Cell Marking

**User Story:** As a Player, I want to mark cells on the bingo board when an event occurs, so that I can track progress toward bingo.

#### Acceptance Criteria

1. WHEN a Player selects an unmarked Cell, THE App SHALL mark that Cell as completed by that Player on the local Board
2. WHEN a Player marks a Cell, THE App SHALL transmit the mark action including the marking Player's role (Host or Guest) to the other Player via the DataChannel
3. WHEN a mark action is received from the other Player, THE App SHALL mark the corresponding Cell on the local Board as marked by that Player
4. THE App SHALL visually distinguish between four Cell states: unmarked, marked by Host only, marked by Guest only, and marked by both Players
5. WHEN a Player selects a Cell that they have previously marked, THE App SHALL remove only that Player's mark from the Cell and transmit the unmark action to the other Player
6. WHEN both Players have independently marked the same Cell, THE App SHALL display that Cell in the marked-by-both state

### Requirement 6: Bingo Detection

**User Story:** As a Player, I want the app to detect when bingo is achieved, so that the game outcome is clear.

#### Acceptance Criteria

1. WHEN a Cell is marked, THE App SHALL check whether any row, column, or diagonal on the Board has all 5 Cells marked
2. WHEN a bingo condition is detected, THE App SHALL display a bingo notification on the local Board and each Player's App SHALL independently detect bingo from its own synchronized Board state
3. THE App SHALL evaluate bingo based on all marked Cells regardless of which Player marked them
4. WHEN bingo is detected, THE App SHALL allow Players to continue marking and unmarking Cells without locking the Board
5. IF a previously completed line is broken by an unmark action, THEN THE App SHALL dismiss the bingo notification and revert to normal play state

### Requirement 7: Real-Time Synchronization

**User Story:** As a Player, I want board changes to appear instantly on both screens, so that the game feels responsive and synchronized.

#### Acceptance Criteria

1. WHEN a Player performs a mark or unmark action, THE App SHALL transmit the action to the connected Player within 100ms of the local state change
2. WHEN an action is received via the DataChannel, THE App SHALL apply it to the local Board state and update the UI within 100ms of receipt
3. WHILE the DataChannel is connected, THE App SHALL maintain a persistent connection without polling
4. IF the DataChannel disconnects unexpectedly, THEN THE App SHALL display a connection-lost indicator to the Player within 3 seconds of detecting the disconnection
5. IF a received action references a Cell that is already in the target state, THEN THE App SHALL treat the action as idempotent and not alter the Cell state
6. WHEN both Players perform conflicting actions on the same Cell simultaneously, THE App SHALL resolve the conflict by applying the most recent action received, resulting in a consistent final state on both Boards

### Requirement 8: State Persistence

**User Story:** As a Player, I want my game state to survive a page reload, so that I do not lose progress if I accidentally refresh.

#### Acceptance Criteria

1. WHEN the Board state changes, THE App SHALL persist the current game state to localStorage within 1 second of the change
2. WHEN a Player reloads the page and valid game state exists in localStorage, THE App SHALL restore the Board state including all marked Cells and their attribution to the correct Player
3. WHEN a Player reloads the page, THE App SHALL attempt to re-establish the DataChannel connection using the stored Room information with a timeout of 10 seconds and up to 3 retry attempts
4. IF the DataChannel reconnection succeeds, THEN THE App SHALL resynchronize by requesting the current Board state from the connected Player and applying any marks not present locally
5. THE App SHALL store the Seed, category selection, marked Cells with Player attribution, and Room connection information in localStorage
6. IF localStorage data is missing or cannot be parsed on page load, THEN THE App SHALL discard the corrupted data and display the initial room creation screen
7. WHEN a new game session is created, THE App SHALL clear any previously persisted game state from localStorage

### Requirement 9: Predefined Categories

**User Story:** As a Player, I want categories to be built into the application, so that I can start playing without manual setup.

#### Acceptance Criteria

1. THE App SHALL include at least three predefined Categories (Shot Speeds, Shot Types, and one additional Category)
2. THE App SHALL define each Category with a unique name and a list of Category_Items where each Category_Item text is unique within its Category
3. THE App SHALL include at least 10 Category_Items per Category, each represented as a text string of no more than 40 characters
4. WHEN the App loads, THE App SHALL make all predefined Categories available for selection without external data fetching
5. THE App SHALL ensure the total number of Category_Items across all predefined Categories is at least 25, so that a full Board can be generated from any combination of selected Categories meeting the minimum threshold

### Requirement 10: Static Hosting Compatibility

**User Story:** As a developer, I want the application to run entirely on GitHub Pages, so that no backend infrastructure is required.

#### Acceptance Criteria

1. THE App SHALL function as a single-page application with client-side routing only
2. THE App SHALL use PeerJS for WebRTC signaling without requiring a custom signaling server
3. THE App SHALL perform all game logic, board generation, and state management on the client side
4. THE App SHALL load all Category data from bundled static assets without runtime API calls
5. THE App SHALL produce a static build output deployable to GitHub Pages via a single build command
6. THE App SHALL handle GitHub Pages URL routing by using hash-based routing or a 404.html redirect strategy
