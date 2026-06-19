import { describe, it, expect } from "vitest";

// Source: src/engine/seeded-random.ts (not yet written — local implementation for test)
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) | 0;
    return (this.state >>> 0) / 0x100000000;
  }

  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}

describe("SeededRandom", () => {
  it("returns deterministic sequence for the same seed", () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);

    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it("returns different sequence for different seeds", () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(99);
    const results = Array.from({ length: 10 }, () => [a.next(), b.next()]);
    const allDifferent = results.some(([va, vb]) => va !== vb);

    expect(allDifferent).toBe(true);
  });

  it("nextInt returns values within [min, max] inclusive", () => {
    const rng = new SeededRandom(42);

    for (let i = 0; i < 1000; i++) {
      const val = rng.nextInt(3, 7);
      expect(val).toBeGreaterThanOrEqual(3);
      expect(val).toBeLessThanOrEqual(7);
    }
  });

  it("next produces values in [0, 1)", () => {
    const rng = new SeededRandom(42);

    for (let i = 0; i < 10000; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});
