/**
 * Share code module for Rocket League Bingo (Supabase version).
 *
 * In this architecture, the share code is derived from the Room UUID.
 * The Room record in the database stores seed and categories,
 * so the share code only needs to identify the Room.
 *
 * Encoding strategy: Convert UUID (128 bits, hex without dashes) to base62,
 * take first 8 characters. The database has a unique index on `share_code`
 * so collisions are detected at insert time.
 */

// Base62 character set: 0-9, A-Z, a-z
const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = 62n;
const SHARE_CODE_LENGTH = 8;

/**
 * Convert a hex string (UUID without dashes) to a base62 string.
 */
function hexToBase62(hex: string): string {
  let num = BigInt('0x' + hex);

  if (num === 0n) {
    return BASE62_CHARS[0]!;
  }

  let result = '';
  while (num > 0n) {
    const remainder = Number(num % BASE);
    result = BASE62_CHARS[remainder]! + result;
    num = num / BASE;
  }

  return result;
}

/**
 * Convert a base62 string back to a hex string of the specified length.
 * Returns null if the string contains invalid characters.
 */
function base62ToHex(str: string, hexLength: number): string | null {
  let num = 0n;
  for (const char of str) {
    const index = BASE62_CHARS.indexOf(char);
    if (index === -1) {
      return null;
    }
    num = num * BASE + BigInt(index);
  }

  const hex = num.toString(16).padStart(hexLength, '0');
  return hex;
}

/**
 * Strip dashes from a UUID string.
 */
function stripDashes(uuid: string): string {
  return uuid.replace(/-/g, '');
}

/**
 * Format a 32-char hex string as a UUID with dashes.
 */
function formatAsUuid(hex: string): string {
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * Encode a Room UUID into a share code (≤8 alphanumeric characters).
 *
 * The full UUID (128 bits) is converted to base62 (~22 chars), and the
 * first 8 characters are taken as the share code. This provides ~47 bits
 * of entropy which is sufficient to avoid collisions in practice.
 * The database unique constraint detects any collision at insert time.
 *
 * @param roomId - A UUID string (with or without dashes)
 * @returns A share code string of exactly 8 alphanumeric characters
 */
export function encodeShareCode(roomId: string): string {
  const hex = stripDashes(roomId).toLowerCase();
  const fullBase62 = hexToBase62(hex);
  // Pad to ensure we always have enough characters
  const padded = fullBase62.padStart(22, '0');
  return padded.slice(0, SHARE_CODE_LENGTH);
}

/**
 * Decode/validate a share code.
 *
 * Since the share code is a truncated base62 encoding (8 chars from 22),
 * it cannot be reversed to recover the full UUID. The actual room lookup
 * is done via a database query on the `share_code` column.
 *
 * This function validates the format and returns the normalized code
 * if valid, or null if the input is malformed.
 *
 * @param code - A candidate share code string
 * @returns The normalized share code if valid, or null
 */
export function decodeShareCode(code: string): string | null {
  if (!validateShareCodeInput(code)) {
    return null;
  }
  return code;
}

/**
 * Build a shareable URL from a share code.
 * Uses hash-based routing: `${origin}${basePath}#/join/${code}`
 *
 * @param code - A valid share code
 * @returns The full shareable URL
 */
export function buildShareUrl(code: string): string {
  const base = typeof window !== 'undefined'
    ? `${window.location.origin}/`
    : 'https://rocket-league-bingo.pansen.xyz/';
  return `${base}#/join/${code}`;
}

/**
 * Parse a share URL and extract the share code.
 * Matches the pattern: .../#/join/{code}
 *
 * @param url - A URL string to parse
 * @returns The share code if found and valid, or null
 */
export function parseShareUrl(url: string): string | null {
  try {
    const hashMatch = url.match(/#\/join\/([A-Za-z0-9]{1,8})/);
    if (!hashMatch) {
      return null;
    }

    const code = hashMatch[1]!;
    if (!validateShareCodeInput(code)) {
      return null;
    }

    return code;
  } catch {
    return null;
  }
}

/**
 * Validate a share code input string.
 *
 * A valid share code is:
 * - Non-empty
 * - At most 8 characters
 * - Contains only alphanumeric characters [a-zA-Z0-9]
 *
 * @param input - The string to validate
 * @returns true if the input is a valid share code format
 */
export function validateShareCodeInput(input: string): boolean {
  if (!input || input.length === 0) {
    return false;
  }
  if (input.length > SHARE_CODE_LENGTH) {
    return false;
  }
  return /^[a-zA-Z0-9]+$/.test(input);
}

// Re-export internals for testing
export { hexToBase62 as _hexToBase62, base62ToHex as _base62ToHex, formatAsUuid as _formatAsUuid };
