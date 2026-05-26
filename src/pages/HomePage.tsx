import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadGameState } from '../logic/persistenceAdapter';

export default function HomePage() {
  const navigate = useNavigate();
  const [hasPersistedState, setHasPersistedState] = useState(false);

  useEffect(() => {
    const persisted = loadGameState();
    if (persisted) {
      setHasPersistedState(true);
    }
  }, []);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Rocket League Bingo</h1>
      <p style={styles.subtitle}>
        Two-player bingo powered by Rocket League events
      </p>

      <div style={styles.buttonGroup}>
        {hasPersistedState && (
          <button
            style={{ ...styles.button, ...styles.resumeButton }}
            onClick={() => navigate('/game')}
          >
            Resume Game
          </button>
        )}
        <button
          style={{ ...styles.button, ...styles.createButton }}
          onClick={() => navigate('/create')}
        >
          Create Room
        </button>
        <button
          style={{ ...styles.button, ...styles.joinButton }}
          onClick={() => navigate('/join')}
        >
          Join Room
        </button>
      </div>
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
    gap: '8px',
  },
  title: {
    margin: '0 0 8px',
  },
  subtitle: {
    marginBottom: '32px',
    color: 'var(--text)',
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
    maxWidth: '280px',
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
  createButton: {
    background: 'var(--accent)',
    color: '#fff',
    borderColor: 'var(--accent)',
  },
  joinButton: {
    background: 'var(--accent-bg)',
    color: 'var(--accent)',
    borderColor: 'var(--accent-border)',
  },
  resumeButton: {
    background: 'var(--code-bg)',
    color: 'var(--text-h)',
    borderColor: 'var(--border)',
  },
};
