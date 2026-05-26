import { describe, it, expect } from 'vitest';
import {
  bytesToBase62,
  base62ToBytes,
  numberToBase62,
  base62ToNumber,
  categoryIdsToBitmask,
  bitmaskToCategoryIds,
  encodeShareCode,
  decodeShareCode,
  buildShareUrl,
  parseShareUrl,
  generateSeed,
  derivePeerId,
} from './shareCodeCodec';
import type { ShareCodeData } from './shareCodeCodec';

describe('shareCodeCodec', () => {
  describe('bytesToBase62 / base62ToBytes', () => {
    it('encodes and decodes zero bytes', () => {
      const bytes = new Uint8Array(16); // all zeros
      const encoded = bytesToBase62(bytes);
      expect(encoded).toBe('0');
      const decoded = base62ToBytes('0', 16);
      expect(decoded).toEqual(bytes);
    });

    it('round-trips arbitrary bytes', () => {
      const bytes = new Uint8Array([255, 128, 64, 32, 16, 8, 4, 2, 1, 0, 200, 150, 100, 50, 25, 12]);
      const encoded = bytesToBase62(bytes);
      const decoded = base62ToBytes(encoded, 16);
      expect(decoded).toEqual(bytes);
    });

    it('returns null for invalid base62 characters', () => {
      const result = base62ToBytes('invalid!chars', 16);
      expect(result).toBeNull();
    });
  });

  describe('numberToBase62 / base62ToNumber', () => {
    it('encodes 0', () => {
      expect(numberToBase62(0)).toBe('0');
    });

    it('encodes small numbers', () => {
      expect(numberToBase62(1)).toBe('1');
      expect(numberToBase62(61)).toBe('z');
      expect(numberToBase62(62)).toBe('10');
    });

    it('round-trips numbers', () => {
      for (const n of [0, 1, 7, 61, 62, 100, 3843, 3844]) {
        expect(base62ToNumber(numberToBase62(n))).toBe(n);
      }
    });

    it('returns null for empty string', () => {
      expect(base62ToNumber('')).toBeNull();
    });

    it('returns null for invalid characters', () => {
      expect(base62ToNumber('abc!')).toBeNull();
    });
  });

  describe('categoryIdsToBitmask / bitmaskToCategoryIds', () => {
    it('encodes single category', () => {
      expect(categoryIdsToBitmask(['shot-speeds'])).toBe(1);
      expect(categoryIdsToBitmask(['shot-types'])).toBe(2);
      expect(categoryIdsToBitmask(['game-events'])).toBe(4);
    });

    it('encodes multiple categories', () => {
      expect(categoryIdsToBitmask(['shot-speeds', 'shot-types'])).toBe(3);
      expect(categoryIdsToBitmask(['shot-speeds', 'game-events'])).toBe(5);
      expect(categoryIdsToBitmask(['shot-speeds', 'shot-types', 'game-events'])).toBe(7);
    });

    it('ignores unknown category IDs', () => {
      expect(categoryIdsToBitmask(['unknown-category'])).toBe(0);
    });

    it('round-trips category IDs', () => {
      const ids = ['shot-speeds', 'game-events'];
      const bitmask = categoryIdsToBitmask(ids);
      const decoded = bitmaskToCategoryIds(bitmask);
      expect(decoded.sort()).toEqual(ids.sort());
    });
  });

  describe('encodeShareCode / decodeShareCode', () => {
    it('produces a code ≤32 characters', () => {
      const data: ShareCodeData = {
        peerId: 'rlb-1234567890ABCDEFGHIJkl',
        seed: '1234567890ABCDEFGHIJkl',
        categoryIds: ['shot-speeds', 'shot-types', 'game-events'],
      };
      const code = encodeShareCode(data);
      expect(code.length).toBeLessThanOrEqual(32);
    });

    it('round-trips valid share code data', () => {
      const data: ShareCodeData = {
        peerId: 'rlb-ABCDEFGHIJKLMNOPQRSTUV',
        seed: 'ABCDEFGHIJKLMNOPQRSTUV',
        categoryIds: ['shot-speeds', 'shot-types'],
      };
      const code = encodeShareCode(data);
      const decoded = decodeShareCode(code);
      expect(decoded).not.toBeNull();
      expect(decoded!.seed).toBe(data.seed);
      expect(decoded!.categoryIds.sort()).toEqual(data.categoryIds.sort());
      expect(decoded!.peerId).toBe(`rlb-${data.seed}`);
    });

    it('round-trips with all categories selected', () => {
      const data: ShareCodeData = {
        peerId: 'rlb-0000000000000000000001',
        seed: '0000000000000000000001',
        categoryIds: ['shot-speeds', 'shot-types', 'game-events'],
      };
      const code = encodeShareCode(data);
      const decoded = decodeShareCode(code);
      expect(decoded).not.toBeNull();
      expect(decoded!.categoryIds.sort()).toEqual(data.categoryIds.sort());
    });

    it('returns null for too-short codes', () => {
      expect(decodeShareCode('abc')).toBeNull();
    });

    it('returns null for too-long codes', () => {
      expect(decodeShareCode('A'.repeat(33))).toBeNull();
    });

    it('returns null for codes with invalid characters', () => {
      expect(decodeShareCode('ABCDEFGHIJKLMNOPQRSTUV!!')).toBeNull();
    });

    it('returns null for zero bitmask (no categories)', () => {
      // 22 chars seed + '0' bitmask = no categories
      expect(decodeShareCode('ABCDEFGHIJKLMNOPQRSTUV0')).toBeNull();
    });
  });

  describe('buildShareUrl / parseShareUrl', () => {
    it('builds a URL with hash-based routing', () => {
      const code = 'ABCDEFGHIJKLMNOPQRSTUV3';
      const url = buildShareUrl(code);
      expect(url).toContain('#/join/');
      expect(url).toContain(code);
    });

    it('round-trips through URL encoding', () => {
      const data: ShareCodeData = {
        peerId: 'rlb-ABCDEFGHIJKLMNOPQRSTUV',
        seed: 'ABCDEFGHIJKLMNOPQRSTUV',
        categoryIds: ['shot-speeds', 'shot-types'],
      };
      const code = encodeShareCode(data);
      const url = buildShareUrl(code);
      const parsed = parseShareUrl(url);
      expect(parsed).not.toBeNull();
      expect(parsed!.seed).toBe(data.seed);
      expect(parsed!.categoryIds.sort()).toEqual(data.categoryIds.sort());
    });

    it('returns null for URLs without join path', () => {
      expect(parseShareUrl('https://example.com/#/create')).toBeNull();
    });

    it('returns null for invalid URLs', () => {
      expect(parseShareUrl('not a url')).toBeNull();
    });

    it('parses URL with valid share code', () => {
      const url = 'https://username.github.io/rocket-league-bingo/#/join/ABCDEFGHIJKLMNOPQRSTUV3';
      const parsed = parseShareUrl(url);
      expect(parsed).not.toBeNull();
      expect(parsed!.seed).toBe('ABCDEFGHIJKLMNOPQRSTUV');
    });
  });

  describe('generateSeed', () => {
    it('produces a 22-character string', () => {
      const seed = generateSeed();
      expect(seed.length).toBe(22);
    });

    it('produces only base62 characters', () => {
      const seed = generateSeed();
      const base62Regex = /^[0-9A-Za-z]+$/;
      expect(seed).toMatch(base62Regex);
    });

    it('produces different seeds on successive calls', () => {
      const seed1 = generateSeed();
      const seed2 = generateSeed();
      expect(seed1).not.toBe(seed2);
    });
  });

  describe('derivePeerId', () => {
    it('prefixes seed with rlb-', () => {
      expect(derivePeerId('ABCDEFGHIJKLMNOPQRSTUV')).toBe('rlb-ABCDEFGHIJKLMNOPQRSTUV');
    });
  });
});
