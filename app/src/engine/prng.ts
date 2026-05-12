// mulberry32 — small, fast, deterministic PRNG. Suitable for Monte Carlo over
// thousands of runs; not cryptographic. Returns a function that emits uniform
// [0, 1) values and advances internal state on each call.
//
// Why not Math.sin(seed) like the original code? sin(0) = 0 makes seed 0
// degenerate (first draw is always 0) and Math.sin has uneven distribution
// over fractional parts.
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
