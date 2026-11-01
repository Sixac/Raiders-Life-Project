/** Small random helpers. Swap Math.random for a seeded generator in tests if needed. */
export const R = (n: number) => Math.floor(Math.random() * n);
export const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const pick = <T>(a: readonly T[]): T => a[R(a.length)];
export const pct = (p: number) => Math.random() * 100 < p;
export const roll = <T>(p: number, a: () => T, b: () => T): T => (pct(p) ? a() : b());

/** Deterministic generator, used so each chapter's scene always looks the same. */
export function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
