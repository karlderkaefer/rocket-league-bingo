import { test, fc } from '@fast-check/vitest';
import { describe, expect } from 'vitest';
import {
  encodeShareCode,
  decodeShareCode,
  buildShareUrl,
  parseShareUrl,
  validateShareCodeInput,
} from './share-code';

/**
 * Property 1: Share code round-trip
 *
 * For any UUID, encodeShareCode returns a string that is ≤8 chars and alphanumeric,
 * and decodeShareCode(encodeShareCode(uuid)) returns a non-null valid string
 * (i.e., the code passes validation).
 *
 * For buildShareUrl/parseShareUrl: for any valid 1-8 char alphanumeric code,
 * parseShareUrl(buildShareUrl(code)) returns the original code.
 *
 * **Validates: Requirements 2.3, 3.1**
 */

const base62Chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// Generator for valid share codes (1-8 alphanumeric characters)
const validShareCodeArb = fc.string({
  minLength: 1,
  maxLength: 8,
  unit: fc.constantFrom(...base62Chars.split('')),
});

describe('Property 1: Share code round-trip', () => {
  test.prop([fc.uuid()], { numRuns: 100 })(
    'encodeShareCode produces ≤8 alphanumeric chars and decodeShareCode accepts it',
    (uuid) => {
      const code = encodeShareCode(uuid);

      // Share code must be at most 8 characters
      expect(code.length).toBeLessThanOrEqual(8);
      expect(code.length).toBeGreaterThan(0);

      // Share code must be alphanumeric
      expect(code).toMatch(/^[a-zA-Z0-9]+$/);

      // decodeShareCode should accept the encoded code (returns non-null)
      const decoded = decodeShareCode(code);
      expect(decoded).not.toBeNull();
      expect(decoded).toBe(code);
    }
  );

  test.prop([validShareCodeArb], { numRuns: 100 })(
    'buildShareUrl/parseShareUrl round-trips for any valid share code',
    (code) => {
      const url = buildShareUrl(code);

      // URL should be a valid string containing the code
      expect(url).toContain(code);

      // parseShareUrl should recover the original code
      const parsed = parseShareUrl(url);
      expect(parsed).toBe(code);
    }
  );
});

/**
 * Property 10: Share code input validation
 *
 * Empty, >8 chars, or non-alphanumeric strings are rejected without DB request.
 *
 * **Validates: Requirements 3.8**
 */

// Generator for strings longer than 8 characters (alphanumeric, so only length matters)
const tooLongStringArb = fc.string({
  minLength: 9,
  maxLength: 50,
  unit: fc.constantFrom(...base62Chars.split('')),
});

// Generator for strings containing at least one non-alphanumeric character
const nonAlphanumericChars = '!@#$%^&*()-_=+[]{}|;:,.<>?/ ~`\'"\\';
const nonAlphanumericCharArb = fc.constantFrom(...nonAlphanumericChars.split(''));
const nonAlphanumericStringArb = fc
  .tuple(
    fc.string({ minLength: 0, maxLength: 4, unit: fc.constantFrom(...base62Chars.split('')) }),
    nonAlphanumericCharArb,
    fc.string({ minLength: 0, maxLength: 4, unit: fc.constantFrom(...base62Chars.split('')) }),
  )
  .map(([prefix, badChar, suffix]) => prefix + badChar + suffix)
  .filter((s) => s.length > 0 && s.length <= 8);

describe('Property 10: Share code input validation', () => {
  test.prop([fc.constant('')], { numRuns: 1 })(
    'empty string is rejected by validateShareCodeInput',
    (input) => {
      expect(validateShareCodeInput(input)).toBe(false);
    }
  );

  test.prop([tooLongStringArb], { numRuns: 100 })(
    'strings longer than 8 chars are rejected by validateShareCodeInput',
    (input) => {
      expect(input.length).toBeGreaterThan(8);
      expect(validateShareCodeInput(input)).toBe(false);
    }
  );

  test.prop([nonAlphanumericStringArb], { numRuns: 100 })(
    'strings with non-alphanumeric characters are rejected by validateShareCodeInput',
    (input) => {
      expect(validateShareCodeInput(input)).toBe(false);
    }
  );
});
