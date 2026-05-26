import { allCategories } from '../data/categories';

/**
 * Share code data structure encoding peer connection info.
 */
export interface ShareCodeData {
  peerId: string;
  seed: string;
  categoryIds: string[];
}

// Base62 character set: 0-9, A-Z, a-z
const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = 62n;

/**
 * Encode a Uint8Array (big-endian) into a base62 string.
 */
export function bytesToBase62(bytes: Uint8Array): string {
  // Convert bytes to a BigInt (big-endian)
  let num = 0n;
  for (const byte of bytes) {
    num = (num << 8n) | BigInt(byte);
  }

  if (num === 0n) {
    return BASE62_CHARS[0];
  }

  let result = '';
  while (num > 0n) {
    const remainder = Number(num % BASE);
    result = BASE62_CHARS[remainder] + result;
    num = num / BASE;
  }

  return result;
}

/**
 * Decode a base62 string back into a Uint8Array of the specified byte length.
 */
export function base62ToBytes(str: string, byteLength: number): Uint8Array | null {
  let num = 0n;
  for (const char of str) {
    const index = BASE62_CHARS.indexOf(char);
    if (index === -1) {
      return null; // Invalid character
    }
    num = num * BASE + BigInt(index);
  }

  // Convert BigInt back to bytes (big-endian)
  const bytes = new Uint8Array(byteLength);
  for (let i = byteLength - 1; i >= 0; i--) {
    bytes[i] = Number(num & 0xFFn);
    num = num >> 8n;
  }

  return bytes;
}

/**
 * Encode a non-negative integer as a base62 string.
 */
export function numberToBase62(num: number): string {
  if (num === 0) {
    return BASE62_CHARS[0];
  }

  let n = BigInt(num);
  let result = '';
  while (n > 0n) {
    const remainder = Number(n % BASE);
    result = BASE62_CHARS[remainder] + result;
    n = n / BASE;
  }

  return result;
}

/**
 * Decode a base62 string back into a non-negative integer.
 * Returns null if the string contains invalid characters.
 */
export function base62ToNumber(str: string): number | null {
  if (str.length === 0) {
    return null;
  }

  let num = 0n;
  for (const char of str) {
    const index = BASE62_CHARS.indexOf(char);
    if (index === -1) {
      return null;
    }
    num = num * BASE + BigInt(index);
  }

  return Number(num);
}

/**
 * Encode category IDs as a bitmask based on their position in allCategories.
 * Each category's position in the allCategories array corresponds to a bit.
 */
export function categoryIdsToBitmask(categoryIds: string[]): number {
  let bitmask = 0;
  for (const id of categoryIds) {
    const index = allCategories.findIndex((cat) => cat.id === id);
    if (index !== -1) {
      bitmask |= (1 << index);
    }
  }
  return bitmask;
}

/**
 * Decode a bitmask back into category IDs based on allCategories positions.
 */
export function bitmaskToCategoryIds(bitmask: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < allCategories.length; i++) {
    if (bitmask & (1 << i)) {
      ids.push(allCategories[i].id);
    }
  }
  return ids;
}

/**
 * Encode share code data into a compact string (≤32 characters).
 *
 * Format: [seed_base62 (22 chars)][category_bitmask_base62 (1-2 chars)]
 * Total: ≤ 24 chars (well within 32 limit)
 *
 * The seed is a 128-bit value encoded as base62 (padded to 22 chars).
 * The category bitmask encodes which categories are selected.
 */
export function encodeShareCode(data: ShareCodeData): string {
  // The seed is already the base62-encoded 128-bit value (22 chars)
  const seedBase62 = data.seed;

  // Encode category selection as bitmask
  const bitmask = categoryIdsToBitmask(data.categoryIds);
  const bitmaskBase62 = numberToBase62(bitmask);

  return seedBase62 + bitmaskBase62;
}

/**
 * Decode a share code string back into ShareCodeData.
 * Returns null if the code is invalid.
 *
 * The first 22 characters are the seed (base62-encoded 128-bit value).
 * The remaining 1-2 characters are the category bitmask.
 */
export function decodeShareCode(code: string): ShareCodeData | null {
  // Validate length: 22 chars seed + 1-2 chars bitmask = 23-24 chars
  if (code.length < 23 || code.length > 24) {
    return null;
  }

  // Validate all characters are base62
  for (const char of code) {
    if (BASE62_CHARS.indexOf(char) === -1) {
      return null;
    }
  }

  // Extract seed (first 22 chars)
  const seedBase62 = code.slice(0, 22);

  // Extract bitmask (remaining chars)
  const bitmaskStr = code.slice(22);
  const bitmask = base62ToNumber(bitmaskStr);
  if (bitmask === null || bitmask === 0) {
    return null; // Invalid bitmask or no categories selected
  }

  // Decode category IDs from bitmask
  const categoryIds = bitmaskToCategoryIds(bitmask);
  if (categoryIds.length === 0) {
    return null;
  }

  // Derive peer ID deterministically from seed
  const peerId = `rlb-${seedBase62}`;

  return {
    peerId,
    seed: seedBase62,
    categoryIds,
  };
}

/**
 * Build a shareable URL from a share code.
 * Uses hash-based routing: /#/join/{code}
 */
export function buildShareUrl(code: string): string {
  const base = typeof window !== 'undefined'
    ? `${window.location.origin}/rocket-league-bingo/`
    : 'https://username.github.io/rocket-league-bingo/';
  return `${base}#/join/${code}`;
}

/**
 * Parse a share URL and extract the ShareCodeData.
 * Returns null if the URL is invalid or the code cannot be decoded.
 */
export function parseShareUrl(url: string): ShareCodeData | null {
  try {
    // Match hash-based route: .../#/join/{code}
    const hashMatch = url.match(/#\/join\/([A-Za-z0-9]+)/);
    if (!hashMatch) {
      return null;
    }

    const code = hashMatch[1];
    return decodeShareCode(code);
  } catch {
    return null;
  }
}

/**
 * Generate a 128-bit random seed encoded as a 22-character base62 string.
 * Uses crypto.getRandomValues for cryptographic randomness.
 */
export function generateSeed(): string {
  const bytes = new Uint8Array(16); // 128 bits
  crypto.getRandomValues(bytes);
  const raw = bytesToBase62(bytes);
  // Pad to exactly 22 characters (128 bits needs at most 22 base62 chars)
  return raw.padStart(22, '0');
}

/**
 * Derive the PeerJS peer ID from a seed (base62 string).
 */
export function derivePeerId(seedBase62: string): string {
  return `rlb-${seedBase62}`;
}
