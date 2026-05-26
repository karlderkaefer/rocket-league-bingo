/** Player role in the session */
export type PlayerRole = 'host' | 'guest';

/** State of marks on a single cell */
export interface CellMarks {
  hostMarked: boolean;
  guestMarked: boolean;
}

/** A single cell on the bingo board */
export interface Cell {
  index: number;        // 0-24, position on board
  text: string;         // Category item display text
  categoryId: string;   // Which category this item belongs to
}

/** The 5×5 bingo board */
export interface Board {
  cells: Cell[];  // 25 cells, row-major order
  seed: string;
  categoryIds: string[];
}

/** Full game state held in memory */
export interface GameState {
  board: Board | null;
  marks: CellMarks[];          // 25 entries, indexed by cell position
  myRole: PlayerRole;
  connected: boolean;
  bingoLines: BingoLine[];     // Currently active bingo lines
  seed: string;
  categoryIds: string[];
}

/** What gets persisted to localStorage */
export interface PersistedState {
  seed: string;
  categoryIds: string[];
  marks: CellMarks[];
  myRole: PlayerRole;
  peerId: string;              // For reconnection
  remotePeerId: string;        // For reconnection
  timestamp: number;           // For staleness detection
}

/** Category definition (bundled static data) */
export interface Category {
  id: string;
  name: string;
  items: string[];             // Each ≤40 characters
}

/** Bingo line descriptor */
export type BingoLine = {
  type: 'row' | 'column' | 'diagonal';
  index: number;               // 0-4 for rows/cols, 0-1 for diagonals
};

/** Messages sent over the DataChannel between peers */
export type GameMessage =
  | { type: 'INIT'; payload: { seed: string; categoryIds: string[] } }
  | { type: 'MARK'; payload: { cellIndex: number; player: PlayerRole } }
  | { type: 'UNMARK'; payload: { cellIndex: number; player: PlayerRole } }
  | { type: 'SYNC_REQUEST' }
  | { type: 'SYNC_RESPONSE'; payload: { marks: CellMarks[] } }
  | { type: 'REJECT'; reason: string }
  | { type: 'PING' }
  | { type: 'PONG' };

/** Actions dispatched to the game state reducer */
export type GameAction =
  | { type: 'MARK_CELL'; cellIndex: number; player: PlayerRole }
  | { type: 'UNMARK_CELL'; cellIndex: number; player: PlayerRole }
  | { type: 'SET_BOARD'; board: Board }
  | { type: 'SYNC_STATE'; state: GameState }
  | { type: 'RESET' };
