/**
 * Seedable RNG with a serializable cursor. Deterministic given a seed.
 * Mulberry32 — fast, good enough for game shuffles.
 */

export interface Rng {
  next(): number;
  nextInt(maxExclusive: number): number;
  shuffle<T>(items: T[]): T[];
  getState(): number;
  setState(state: number): void;
}

function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0) || 1;
}

export function createRng(seed: string, initialState?: number): Rng {
  let state = initialState ?? hashSeed(seed);

  const next = (): number => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    nextInt(maxExclusive: number): number {
      if (maxExclusive <= 0) return 0;
      return Math.floor(next() * maxExclusive);
    },
    shuffle<T>(items: T[]): T[] {
      const arr = [...items];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = arr[i]!;
        arr[i] = arr[j]!;
        arr[j] = tmp;
      }
      return arr;
    },
    getState(): number {
      return state;
    },
    setState(s: number): void {
      state = s;
    },
  };
}
