import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { generateSeed, buildShareUrl } from '../logic/shareCodeCodec';
import { allCategories } from '../data/categories';

type PageStep = 'category-selection' | 'connecting' | 'waiting' | 'error';

export default function CreateRoomPage() {
  const navigate = useNavigate();
  const { createRoom, connectionStatus } = useGame();

  // Seed generated on mount
  const [seed] = useState(() => generateSeed());

  // Category selection state
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  // Page flow state
  const [step, setStep] = useState<PageStep>('category-selection');
  const [shareCode, setShareCode] = useState<string>('');
  const [shareUrl, setShareUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Calculate total items from selected categories
  const totalSelectedItems = selectedCategoryIds.reduce((sum, id) => {
    const category = allCategories.find((c) => c.id === id);
    return sum + (category ? category.items.length : 0);
  }, 0);

  const canConfirm = totalSelectedItems >= 25;
  const itemsNeeded = Math.max(0, 25 - totalSelectedItems);

  // Toggle category selection
  const toggleCategory = useCallback((categoryId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  }, []);

  // Handle category confirmation and room creation
  const handleConfirm = useCallback(async () => {
    if (!canConfirm) return;

    setStep('connecting');
    setError('');

    try {
      const code = await createRoom(seed, selectedCategoryIds);
      setShareCode(code);
      setShareUrl(buildShareUrl(code));
      setStep('waiting');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not connect to signaling server. Check your internet connection.';
      setError(message);
      setStep('error');
    }
  }, [canConfirm, createRoom, seed, selectedCategoryIds]);

  // Handle retry after error
  const handleRetry = useCallback(() => {
    setStep('category-selection');
    setError('');
  }, []);

  // Copy share URL to clipboard
  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text for manual copy
    }
  }, [shareUrl]);

  // Navigate to game when guest connects
  useEffect(() => {
    if (step === 'waiting' && connectionStatus === 'connected') {
      navigate('/game');
    }
  }, [step, connectionStatus, navigate]);

  // --- Render based on current step ---

  if (step === 'error') {
    return (
      <div className="create-room-page">
        <h1>Create Room</h1>
        <div className="error-panel" role="alert">
          <p className="error-message">{error}</p>
          <button onClick={handleRetry} className="retry-button">
            Retry
          </button>
        </div>
        <Link to="/">Back to Home</Link>
      </div>
    );
  }

  if (step === 'connecting') {
    return (
      <div className="create-room-page">
        <h1>Create Room</h1>
        <div className="connecting-indicator" aria-live="polite">
          <p>Initializing connection...</p>
        </div>
      </div>
    );
  }

  if (step === 'waiting') {
    return (
      <div className="create-room-page">
        <h1>Create Room</h1>
        <div className="share-code-panel">
          <h2>Share Code</h2>
          <p className="share-code" aria-label="Share code">
            {shareCode}
          </p>
          <div className="share-url-section">
            <input
              type="text"
              readOnly
              value={shareUrl}
              aria-label="Shareable URL"
              className="share-url-input"
            />
            <button onClick={handleCopyUrl} className="copy-url-button">
              {copied ? 'Copied!' : 'Copy URL'}
            </button>
          </div>
        </div>
        <div className="waiting-indicator" aria-live="polite">
          <p>Waiting for player to join...</p>
        </div>
        <Link to="/">Back to Home</Link>
      </div>
    );
  }

  // Default: category-selection step
  return (
    <div className="create-room-page">
      <h1>Create Room</h1>
      <div className="category-selector">
        <h2>Select Categories</h2>
        <p className="category-help">
          Select categories for the bingo board. You need at least 25 items
          total.
        </p>
        <ul className="category-list" role="list">
          {allCategories.map((category) => {
            const isSelected = selectedCategoryIds.includes(category.id);
            return (
              <li key={category.id} className="category-item">
                <label className="category-label">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleCategory(category.id)}
                    aria-label={`${category.name} (${category.items.length} items)`}
                  />
                  <span className="category-name">{category.name}</span>
                  <span className="category-count">
                    ({category.items.length} items)
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="selection-summary">
          <p>
            Total items selected: <strong>{totalSelectedItems}</strong>
          </p>
          {!canConfirm && (
            <p className="items-needed-message">
              {itemsNeeded} more item{itemsNeeded !== 1 ? 's' : ''} needed
            </p>
          )}
        </div>
        <button
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="confirm-button"
          aria-disabled={!canConfirm}
        >
          Confirm Selection
        </button>
      </div>
      <Link to="/">Back to Home</Link>
    </div>
  );
}
