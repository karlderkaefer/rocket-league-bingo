/**
 * Shape sampling for the win celebration.
 *
 * The smoke particles coalesce into a target silhouette (e.g. the word
 * "BINGO!"). To drive that, we need a set of target points describing the
 * shape. We draw text to an offscreen canvas, read back its pixels, and
 * collect the opaque ones as normalized target coordinates.
 *
 * The pixel-scanning step is kept pure (operates on a plain pixel buffer) so
 * it can be unit-tested without a real canvas.
 */

/** A normalized target point in clip space ([-1, 1], y-up). */
export interface ShapePoint {
  x: number;
  y: number;
}

export interface SamplePointsOptions {
  /** Image width in pixels. */
  width: number;
  /** Image height in pixels. */
  height: number;
  /** Sample every Nth pixel in each axis (>= 1). Larger = fewer points. */
  step?: number;
  /** Alpha threshold (0-255) above which a pixel is considered opaque. */
  alphaThreshold?: number;
}

/**
 * Scan an RGBA pixel buffer and return opaque pixels as normalized points.
 *
 * Output coordinates are in clip space: x and y in [-1, 1], with y flipped so
 * that the top of the image maps to +1 (canvas y grows downward, clip y grows
 * upward). Aspect ratio is preserved relative to the wider axis so the shape
 * is not distorted.
 *
 * Pure function — no canvas/DOM dependency.
 */
export function sampleOpaquePoints(
  pixels: Uint8ClampedArray,
  { width, height, step = 4, alphaThreshold = 128 }: SamplePointsOptions,
): ShapePoint[] {
  const points: ShapePoint[] = [];
  const s = Math.max(1, Math.floor(step));
  const aspect = width / height;

  for (let y = 0; y < height; y += s) {
    for (let x = 0; x < width; x += s) {
      const alpha = pixels[(y * width + x) * 4 + 3] ?? 0;
      if (alpha < alphaThreshold) continue;

      // Normalize to [-1, 1]. Correct aspect against the wider axis so the
      // shape keeps its proportions.
      let nx = (x / width) * 2 - 1;
      let ny = -((y / height) * 2 - 1); // flip y
      if (aspect >= 1) {
        ny /= aspect;
      } else {
        nx *= aspect;
      }
      points.push({ x: nx, y: ny });
    }
  }

  return points;
}

/**
 * Build a per-particle target buffer (xyz) by distributing particles across
 * the sampled shape points. Particles are assigned in shuffled order so the
 * coalescing looks organic rather than banded. When there are more particles
 * than sample points, points are reused (wrapped).
 *
 * @param particleCount total number of particles
 * @param points sampled shape points (normalized clip space)
 * @param rand pseudo-random source in [0, 1) (injectable for determinism/tests)
 * @param depth max random z spread to give the shape a little volume
 */
export function buildTargetPositions(
  particleCount: number,
  points: ShapePoint[],
  rand: () => number = Math.random,
  depth = 0.15,
): Float32Array {
  const targets = new Float32Array(particleCount * 3);
  if (points.length === 0) {
    // Degenerate fallback: aim everything at the origin.
    return targets;
  }

  for (let i = 0; i < particleCount; i++) {
    const p = points[Math.floor(rand() * points.length)]!;
    targets[i * 3 + 0] = p.x;
    targets[i * 3 + 1] = p.y;
    targets[i * 3 + 2] = (rand() * 2 - 1) * depth;
  }

  return targets;
}
