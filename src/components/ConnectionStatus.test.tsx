import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ConnectionStatus from './ConnectionStatus';

describe('ConnectionStatus', () => {
  it('renders green dot and "Connected" for connected status', () => {
    render(<ConnectionStatus status="connected" />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Connection status: Connected'
    );
  });

  it('renders yellow dot and "Connecting..." for connecting status', () => {
    render(<ConnectionStatus status="connecting" />);
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Connection status: Connecting...'
    );
  });

  it('renders orange dot and "Reconnecting..." for reconnecting status', () => {
    render(<ConnectionStatus status="reconnecting" />);
    expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Connection status: Reconnecting...'
    );
  });

  it('renders red dot and "Disconnected" for disconnected status', () => {
    render(<ConnectionStatus status="disconnected" />);
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Connection status: Disconnected'
    );
  });

  it('has aria-live="polite" for screen reader announcements', () => {
    render(<ConnectionStatus status="connected" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('indicator dot is hidden from screen readers', () => {
    const { container } = render(<ConnectionStatus status="connected" />);
    const indicator = container.querySelector('[aria-hidden="true"]');
    expect(indicator).toBeInTheDocument();
  });
});
