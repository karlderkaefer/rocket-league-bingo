import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { loadGameState } from '../logic/persistenceAdapter';
import { generateBoard } from '../logic/boardGenerator';

export default function GamePage() {
  const navigate = useNavigate();
  const { state, markCell, unmarkCell, resetGame, connectionStatus } = useGame();

  // Attempt to restore board from localStorage if not in context
  useEffect(() => {
    if (!state.board) {
      const persisted = loadGameState();
      if (!persisted) {
        navigate('/');
      }
    }
  }, [state.board, navigate]);

  // Generate board from persisted state if context has no board but localStorage does
  const board = useMemo(() => {
    if (state.board) return state.board;
    const persisted = loadGameState();
    if (persisted) {
      return generateBoard({ seed: persisted.seed, categoryIds: persisted.categoryIds });
    }
    return null;
  }, [state.board]);

  if (!board) {
    return null; // Will redirect via useEffect
  }

  const handleCellClick = (cellIndex: number) => {
    const mark = state.marks[cellIndex] as { hostMarked: boolean; guestMarked: boolean } | undefined;
    if (!mark) return;
    const isMarkedByMe =
      state.myRole === 'host' ? mark.hostMarked : mark.guestMarked;

    if (isMarkedByMe) {
      unmarkCell(cellIndex);
    } else {
      markCell(cellIndex);
    }
  };

  const handleLeaveGame = () => {
    resetGame();
    navigate('/');
  };

  const getCellClassName = (cellIndex: number): string => {
    const mark = state.marks[cellIndex];
    const classes = ['game-cell'];

    if (mark?.hostMarked && mark?.guestMarked) {
      classes.push('marked-both');
    } else if (mark?.hostMarked) {
      classes.push('marked-host');
    } else if (mark?.guestMarked) {
      classes.push('marked-guest');
    }

    return classes.join(' ');
  };

  const connectionLabel =
    connectionStatus === 'connected'
      ? '🟢 Connected'
      : connectionStatus === 'connecting'
        ? '🟡 Connecting...'
        : connectionStatus === 'reconnecting'
          ? '🟠 Reconnecting...'
          : '🔴 Disconnected';

  return (
    <div style={styles.container}>
      {/* Connection Status */}
      <div style={styles.statusBar}>
        <span style={styles.connectionStatus}>{connectionLabel}</span>
        <button style={styles.leaveButton} onClick={handleLeaveGame}>
          Leave Game
        </button>
      </div>

      {/* Bingo Notification */}
      {state.bingoLines.length > 0 && (
        <div style={styles.bingoNotification} role="alert">
          🎉 BINGO! {state.bingoLines.length} line{state.bingoLines.length > 1 ? 's' : ''} completed!
        </div>
      )}

      {/* Board Grid (5×5) */}
      <div style={styles.boardGrid} role="grid" aria-label="Bingo board">
        {board.cells.map((cell) => {
          const mark = state.marks[cell.index] ?? { hostMarked: false, guestMarked: false };
          const isMarked = mark.hostMarked || mark.guestMarked;
          const myMark = state.myRole === 'host' ? mark.hostMarked : mark.guestMarked;
          return (
            <button
              key={cell.index}
              className={getCellClassName(cell.index)}
              style={{
                ...styles.cell,
                ...getCellStyle(mark),
              }}
              onClick={() => handleCellClick(cell.index)}
              aria-label={`${cell.text}${isMarked ? ', marked' : ''}`}
              aria-pressed={myMark}
            >
              <span style={styles.cellText}>{cell.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getCellStyle(mark: { hostMarked: boolean; guestMarked: boolean }): React.CSSProperties {
  if (mark.hostMarked && mark.guestMarked) {
    return {
      background: 'var(--accent)',
      color: '#fff',
      borderColor: 'var(--accent)',
    };
  }
  if (mark.hostMarked) {
    return {
      background: 'var(--accent-bg)',
      borderColor: 'var(--accent)',
    };
  }
  if (mark.guestMarked) {
    return {
      background: 'var(--guest-bg)',
      borderColor: 'var(--guest-border)',
    };
  }
  return {};
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px',
    gap: '16px',
    width: '100%',
    maxWidth: '600px',
    margin: '0 auto',
  },
  statusBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  connectionStatus: {
    fontSize: '14px',
    fontWeight: 500,
  },
  leaveButton: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--code-bg)',
    color: 'var(--text)',
    cursor: 'pointer',
  },
  bingoNotification: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    background: 'var(--bingo-bg)',
    border: '2px solid var(--bingo-border)',
    textAlign: 'center',
    fontWeight: 600,
    fontSize: '18px',
    color: 'var(--bingo-text)',
  },
  boardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '4px',
    width: '100%',
    aspectRatio: '1',
  },
  cell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
    borderRadius: '6px',
    border: '2px solid var(--border)',
    background: 'var(--code-bg)',
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
    minHeight: '60px',
  },
  cellText: {
    fontSize: '11px',
    textAlign: 'center',
    lineHeight: '1.2',
    wordBreak: 'break-word',
    overflow: 'hidden',
  },
};
