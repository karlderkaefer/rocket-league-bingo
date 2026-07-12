import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { WinCelebration } from './WinCelebration';

/** Mock matchMedia with a fixed reduced-motion preference. */
function mockMatchMedia(reduced: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('prefers-reduced-motion') ? reduced : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );
}

describe('WinCelebration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders nothing when show is false', () => {
    mockMatchMedia(false);
    const { container } = render(<WinCelebration show={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a static banner when reduced motion is preferred', () => {
    mockMatchMedia(true);
    render(<WinCelebration show text="BINGO!" />);
    expect(screen.getByRole('status')).toHaveTextContent('BINGO!');
  });

  it('auto-dismisses the reduced-motion banner via onDone', () => {
    mockMatchMedia(true);
    const onDone = vi.fn();
    render(<WinCelebration show onDone={onDone} />);
    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('gracefully calls onDone when WebGL2 is unavailable', () => {
    // jsdom has no WebGL2, so the engine construction throws and we fall back.
    mockMatchMedia(false);
    const onDone = vi.fn();
    render(<WinCelebration show onDone={onDone} />);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
