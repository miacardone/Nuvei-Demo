/**
 * Deterministic pseudo-random source.
 *
 * The reference used `i % n` cycling, which is deterministic but visibly
 * patterned — its status column repeated every four rows. A seeded PRNG gives
 * the same reproducibility without the periodicity.
 *
 * Dates are the deliberate exception: they anchor to now() at module load, so
 * the seed controls the OFFSETS, not the calendar. See cases.js.
 */

/** mulberry32 — small, fast, good enough distribution for fixture data. */
export function createRng(seed = 1) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createDraw(seed) {
  const rng = createRng(seed);

  const float = (min = 0, max = 1) => min + rng() * (max - min);
  const int = (min, max) => Math.floor(float(min, max + 1));
  const pick = (list) => list[Math.floor(rng() * list.length)];
  const bool = (p = 0.5) => rng() < p;

  /** @param {Array<[value, weight]>} pairs */
  const weighted = (pairs) => {
    const total = pairs.reduce((s, [, w]) => s + w, 0);
    let roll = rng() * total;
    for (const [value, weight] of pairs) {
      roll -= weight;
      if (roll <= 0) return value;
    }
    return pairs[pairs.length - 1][0];
  };

  const sample = (list, count) => {
    const pool = [...list];
    const out = [];
    for (let i = 0; i < count && pool.length; i += 1) {
      out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    }
    return out;
  };

  const shuffle = (list) => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  const money = (min, max) => Math.round(float(min, max) * 100) / 100;
  const digits = (length) => Array.from({ length }, () => String(Math.floor(rng() * 10))).join('');

  return { rng, float, int, pick, bool, weighted, sample, shuffle, money, digits };
}

export default createDraw;
