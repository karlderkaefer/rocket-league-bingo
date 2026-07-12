/**
 * Retry utility with exponential backoff.
 * Retries a failed async operation up to `maxAttempts` times
 * with increasing delays between attempts.
 */

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  backoffMultiplier: 2, // 1s, 2s, 4s
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps an async operation with retry logic using exponential backoff.
 *
 * @param operation - The async function to retry on failure
 * @param config - Retry configuration (defaults: 3 attempts, 1s/2s/4s backoff)
 * @returns The result of the operation if it eventually succeeds
 * @throws The last error if all retries are exhausted
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error = new Error('withRetry: no attempts made');

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < config.maxAttempts - 1) {
        await delay(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt)
        );
      }
    }
  }

  throw lastError;
}
