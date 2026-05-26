import styles from './ConnectionStatus.module.css';

export interface ConnectionStatusProps {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
}

const statusConfig: Record<
  ConnectionStatusProps['status'],
  { label: string; className: string }
> = {
  connected: { label: 'Connected', className: styles.connected ?? '' },
  connecting: { label: 'Connecting...', className: styles.connecting ?? '' },
  reconnecting: { label: 'Reconnecting...', className: styles.reconnecting ?? '' },
  disconnected: { label: 'Disconnected', className: styles.disconnected ?? '' },
};

/**
 * Displays the current connection status with a colored dot indicator.
 * Shows disconnection within 3 seconds of detection (driven by prop updates).
 */
export default function ConnectionStatus({ status }: ConnectionStatusProps) {
  const { label, className } = statusConfig[status];

  return (
    <div
      className={styles.container}
      role="status"
      aria-live="polite"
      aria-label={`Connection status: ${label}`}
    >
      <span className={`${styles.indicator} ${className}`} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
