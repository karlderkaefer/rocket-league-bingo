import { describe, it, expect } from 'vitest';

import { sampleOpaquePoints, buildTargetPositions, type ShapePoint } from './shapeSampler';

/** Build an RGBA buffer with a single opaque pixel at (px, py). */
function pixelBufferWithOpaqueAt(
  width: number,
  height: number,
  opaque: Array<[number, number]>,
): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(width * height * 4);
  for (const [px, py] of opaque) {
    buf[(py * width + px) * 4 + 3] = 255;
  }
  return buf;
}

describe('sampleOpaquePoints', () => {
  it('returns no points when everything is transparent', () => {
    const buf = new Uint8ClampedArray(4 * 4 * 4); // all zero alpha
    expect(sampleOpaquePoints(buf, { width: 4, height: 4, step: 1 })).toEqual([]);
  });

  it('finds opaque pixels above the alpha threshold', () => {
    const buf = pixelBufferWithOpaqueAt(4, 4, [[0, 0]]);
    const points = sampleOpaquePoints(buf, { width: 4, height: 4, step: 1 });
    expect(points.length).toBe(1);
  });

  it('ignores pixels below the alpha threshold', () => {
    const buf = new Uint8ClampedArray(2 * 2 * 4);
    buf[3] = 100; // below default threshold of 128
    expect(sampleOpaquePoints(buf, { width: 2, height: 2, step: 1 })).toEqual([]);
  });

  it('produces coordinates within clip space [-1, 1]', () => {
    // Fully opaque 8x8 image.
    const buf = new Uint8ClampedArray(8 * 8 * 4).fill(255);
    const points = sampleOpaquePoints(buf, { width: 8, height: 8, step: 1 });
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(-1);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(-1);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });

  it('flips the y axis so the top row maps to positive y', () => {
    // One opaque pixel in the top row, one in the bottom row.
    const buf = pixelBufferWithOpaqueAt(4, 4, [[0, 0], [0, 3]]);
    const points = sampleOpaquePoints(buf, { width: 4, height: 4, step: 3 });
    const [top, bottom] = points;
    expect(top!.y).toBeGreaterThan(bottom!.y);
  });

  it('respects the step to subsample the image', () => {
    const buf = new Uint8ClampedArray(8 * 8 * 4).fill(255);
    const dense = sampleOpaquePoints(buf, { width: 8, height: 8, step: 1 });
    const sparse = sampleOpaquePoints(buf, { width: 8, height: 8, step: 4 });
    expect(sparse.length).toBeLessThan(dense.length);
  });
});

describe('buildTargetPositions', () => {
  const points: ShapePoint[] = [
    { x: -0.5, y: 0.5 },
    { x: 0.5, y: -0.5 },
  ];

  it('produces xyz targets for every particle', () => {
    const targets = buildTargetPositions(5, points, () => 0, 0);
    expect(targets.length).toBe(5 * 3);
  });

  it('assigns each particle to one of the sampled points', () => {
    // rand() = 0 always picks index 0.
    const targets = buildTargetPositions(3, points, () => 0, 0);
    for (let i = 0; i < 3; i++) {
      expect(targets[i * 3 + 0]).toBeCloseTo(-0.5);
      expect(targets[i * 3 + 1]).toBeCloseTo(0.5);
    }
  });

  it('applies z depth within the requested range', () => {
    const targets = buildTargetPositions(4, points, () => 0.75, 0.2);
    for (let i = 0; i < 4; i++) {
      const z = targets[i * 3 + 2]!;
      expect(Math.abs(z)).toBeLessThanOrEqual(0.2);
    }
  });

  it('returns all-zero targets when there are no shape points', () => {
    const targets = buildTargetPositions(3, [], () => 0.5);
    expect(Array.from(targets)).toEqual(new Array(9).fill(0));
  });
});
