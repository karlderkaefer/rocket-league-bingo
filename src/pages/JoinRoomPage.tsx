import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { RoomFullError, PeerUnavailableError, ConnectionTimeoutError } from '../network/connectionManager';

type JoinState = 'idle' | 'connecting' | 'connected' | 'error';

export default function JoinRoomPage() {
  const { code } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const { joinRoom, connectionStatus, state } = useGame();

  const [joinState, setJoinState] = useState<JoinState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [inputCode, setInputCode] = useState('');
  const hasAutoJoined = useRef(false);

  const handleJoin = useCallback(
    async (shareCode: string) => {
      const trimmed = shareCode.trim();
      if (!trimmed) return;

      setJoinState('connecting');
      setErrorMessage('');

      try {
        await joinRoom(trimmed);
        setJoinState('connected');
      } catch (err: unknown) {
        setJoinState('error');
        if (err instanceof RoomFullError) {
          setErrorMessage('This room already has a player.');
        } else if (err instanceof PeerUnavailableError || err instanceof ConnectionTimeoutError) {
          setErrorMessage('Host is unreachable. They may have closed the room.');
        } else if (err instanceof Error && err.message.includes('Invalid share code')) {
          setErrorMessage('Invalid share code. Please check and try again.');
        } else {
          setErrorMessage('Invalid share code. Please check and try again.');
        }
      }
    },
    [joinRoom]
  );

  // Auto-join when code param is present
  useEffect(() => {
    if (code && !hasAutoJoined.current) {
      hasAutoJoined.current = true;
      handleJoin(code);
    }
  }, [code, handleJoin]);

  // Navigate to /game when connection is established AND board is ready
  useEffect(() => {
    if (connectionStatus === 'connected' && joinState === 'connected' && state.board) {
      navigate('/game');
    }
  }, [connectionStatus, joinState, navigate, state.board]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleJoin(inputCode);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Join Room</h1>

      {joinState === 'connecting' && (
        <div style={styles.statusContainer}>
          <p style={styles.connectingText}>Connecting to host...</p>
          <div style={styles.spinner} aria-label="Connecting" />
        </div>
      )}

      {joinState === 'error' && (
        <div style={styles.errorContainer} role="alert">
          <p style={styles.errorText}>{errorMessage}</p>
          <button
            style={{ ...styles.button, ...styles.retryButton }}
            onClick={() => {
              setJoinState('idle');
              setErrorMessage('');
            }}
          >
            Try Again
          </button>
        </div>
      )}

      {joinState === 'idle' && (
        <form onSubmit={handleSubmit} style={styles.form}>
          <label htmlFor="share-code-input" style={styles.label}>
            Enter share code
          </label>
          <input
            id="share-code-input"
            type="text"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            placeholder="Paste share code here"
            style={styles.input}
            autoFocus
            autoComplete="off"
          />
          <button
            type="submit"
            style={{ ...styles.button, ...styles.joinButton }}
            disabled={!inputCode.trim()}
          >
            Join
          </button>
        </form>
      )}

      <Link to="/" style={styles.backLink}>
        Back to Home
      </Link>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    padding: '32px 20px',
    gap: '16px',
  },
  title: {
    margin: '0 0 8px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
    maxWidth: '320px',
  },
  label: {
    fontSize: '14px',
    color: 'var(--text)',
  },
  input: {
    padding: '12px 16px',
    fontSize: '16px',
    borderRadius: '8px',
    border: '2px solid var(--border)',
    background: 'var(--code-bg)',
    color: 'var(--text-h)',
    fontFamily: 'var(--mono)',
    textAlign: 'center',
    letterSpacing: '1px',
  },
  button: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 500,
    borderRadius: '8px',
    border: '2px solid transparent',
    cursor: 'pointer',
    transition: 'border-color 0.3s, box-shadow 0.3s',
    fontFamily: 'var(--sans)',
  },
  joinButton: {
    background: 'var(--accent)',
    color: '#fff',
    borderColor: 'var(--accent)',
  },
  retryButton: {
    background: 'var(--accent-bg)',
    color: 'var(--accent)',
    borderColor: 'var(--accent-border)',
  },
  statusContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  connectingText: {
    color: 'var(--text)',
    fontSize: '16px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid var(--border)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    borderRadius: '8px',
    background: 'var(--code-bg)',
    border: '1px solid var(--border)',
    maxWidth: '320px',
    width: '100%',
  },
  errorText: {
    color: '#e74c3c',
    margin: 0,
    textAlign: 'center',
  },
  backLink: {
    marginTop: '16px',
    color: 'var(--accent)',
    textDecoration: 'none',
    fontSize: '14px',
  },
};
