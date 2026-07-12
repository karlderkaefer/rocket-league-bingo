import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { ConnectionStatus } from './ConnectionStatus';

describe('ConnectionStatus', () => {
  it('shows "Connecting…" text when connectionState is connecting', () => {
    render(<ConnectionStatus connectionState="connecting" onRetry={vi.fn()} />);

    expect(screen.getByText('Connecting…')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Connecting');
  });

  it('shows green indicator with sr-only "Connected" when connected', () => {
    render(<ConnectionStatus connectionState="connected" onRetry={vi.fn()} />);

    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toHaveClass('sr-only');
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Connected');
  });

  it('shows "Reconnecting…" banner when disconnected (after delay)', async () => {
    vi.useFakeTimers();

    render(<ConnectionStatus connectionState="disconnected" onRetry={vi.fn()} />);

    // Initially not shown (delay hasn't elapsed)
    expect(screen.queryByText('Reconnecting…')).not.toBeInTheDocument();

    // After the 1s delay, banner appears
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('Reconnecting…')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('shows "Connection lost" banner with retry button when error', () => {
    render(<ConnectionStatus connectionState="error" onRetry={vi.fn()} />);

    expect(screen.getByText(/Connection lost/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('retry button calls onRetry when clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(<ConnectionStatus connectionState="error" onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('hides disconnect banner when state changes back to connected', async () => {
    vi.useFakeTimers();

    const { rerender } = render(
      <ConnectionStatus connectionState="disconnected" onRetry={vi.fn()} />
    );

    // Wait for the banner to appear
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Reconnecting…')).toBeInTheDocument();

    // Reconnect
    rerender(<ConnectionStatus connectionState="connected" onRetry={vi.fn()} />);

    expect(screen.queryByText('Reconnecting…')).not.toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('renders nothing initially when disconnected (before delay)', () => {
    const { container } = render(
      <ConnectionStatus connectionState="disconnected" onRetry={vi.fn()} />
    );

    // No banner, no status indicators visible
    expect(screen.queryByText('Reconnecting…')).not.toBeInTheDocument();
    expect(container.querySelector('[role="status"]')).not.toBeInTheDocument();
  });
});
