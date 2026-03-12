import { describe, it, expect } from 'vitest';
import { createRng, randomInt } from '../src/core/rng.js';

describe('createRng', () => {
  it('produces deterministic sequence for same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('returns values in [0, 1)', () => {
    const rng = createRng(999);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('randomInt', () => {
  it('returns values within bounds', () => {
    const rng = createRng(123);
    for (let i = 0; i < 500; i++) {
      const v = randomInt(rng, 3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  it('returns min when min equals max', () => {
    const rng = createRng(1);
    expect(randomInt(rng, 5, 5)).toBe(5);
  });

  it('covers the full range', () => {
    const rng = createRng(77);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      seen.add(randomInt(rng, 0, 3));
    }
    expect(seen.size).toBe(4);
  });
});
