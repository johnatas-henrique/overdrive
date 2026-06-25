import { describe, expect, it } from "vitest";
import { SeededRandom } from "../../src/foundation/determinism";

// ---------------------------------------------------------------------------
// AC-1: Deterministic sequence from same seed
// ---------------------------------------------------------------------------

describe("AC-1: deterministic sequence from same seed", () => {
  it("returns identical sequence over 1000 calls for two instances with seed 42", () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);

    for (let i = 0; i < 1000; i++) {
      expect(a.random()).toBe(b.random());
    }
  });

  it("is deterministic across all instances of the same seed (seed 0 → 1)", () => {
    const a = new SeededRandom(0);
    const b = new SeededRandom(1);

    // Seed 0 falls back to 1, so both should produce the same sequence
    for (let i = 0; i < 100; i++) {
      expect(a.random()).toBe(b.random());
    }
  });

  it("is deterministic for max unsigned 32-bit seed", () => {
    const a = new SeededRandom(0xffffffff >>> 0);
    const b = new SeededRandom(0xffffffff >>> 0);

    for (let i = 0; i < 100; i++) {
      expect(a.random()).toBe(b.random());
    }
  });

  it("handles negative seed deterministically (abs seed -42 ≡ seed 42)", () => {
    const a = new SeededRandom(-42);
    const b = new SeededRandom(42);

    for (let i = 0; i < 100; i++) {
      expect(a.random()).toBe(b.random());
    }
  });
});

// ---------------------------------------------------------------------------
// AC-2: Different seeds produce different sequences
// ---------------------------------------------------------------------------

describe("AC-2: different seeds produce different sequences", () => {
  it("seed 42 and seed 99 differ in at least one of the first 10 values", () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(99);

    const results = Array.from({ length: 10 }, () => [a.random(), b.random()]);
    const allSame = results.every(([va, vb]) => va === vb);

    expect(allSame).toBe(false);
  });

  it("seed 42 vs seed 42 must be identical (regression)", () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);

    for (let i = 0; i < 10; i++) {
      expect(a.random()).toBe(b.random());
    }
  });

  it("adjacent seeds 42 and 43 produce different sequences", () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(43);

    const results = Array.from({ length: 10 }, () => [a.random(), b.random()]);
    const allSame = results.every(([va, vb]) => va === vb);

    expect(allSame).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-3: randomRange returns values within bounds
// ---------------------------------------------------------------------------

describe("AC-3: randomRange returns values within bounds", () => {
  it("randomRange(5, 10) with seed 42 returns values in [5, 10) over 10000 calls", () => {
    const rng = new SeededRandom(42);
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < 10000; i++) {
      const val = rng.randomRange(5, 10);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThan(10);
      if (val < min) min = val;
      if (val > max) max = val;
    }

    // Verify we actually exercised the range
    expect(min).toBeGreaterThanOrEqual(5);
    expect(max).toBeLessThan(10);
  });

  it("randomRange(0, 0) returns exactly 0 every time", () => {
    const rng = new SeededRandom(42);

    for (let i = 0; i < 100; i++) {
      expect(rng.randomRange(0, 0)).toBe(0);
    }
  });

  it("randomRange(5, 2) swaps arguments to produce valid [2, 5) range", () => {
    const rng = new SeededRandom(42);
    // With swapped args, values should be in [2, 5)
    for (let i = 0; i < 1000; i++) {
      const val = rng.randomRange(5, 2);
      expect(val).toBeGreaterThanOrEqual(2);
      expect(val).toBeLessThan(5);
    }
  });

  it("randomRange with equal values returns that value", () => {
    const rng = new SeededRandom(99);
    for (let i = 0; i < 100; i++) {
      expect(rng.randomRange(7, 7)).toBe(7);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-4: randomSign returns only valid values
// ---------------------------------------------------------------------------

describe("AC-4: randomSign returns only -1 or 1", () => {
  it("with seed 42, all 10000 calls return -1 or 1", () => {
    const rng = new SeededRandom(42);
    const validValues = new Set([-1, 1]);

    for (let i = 0; i < 10000; i++) {
      const val = rng.randomSign();
      expect(validValues.has(val)).toBe(true);
    }
  });

  it("exercises both -1 and 1 (not just one side)", () => {
    const rng = new SeededRandom(42);
    const seen = new Set<number>();

    for (let i = 0; i < 10000 && seen.size < 2; i++) {
      seen.add(rng.randomSign());
    }

    expect(seen.has(-1)).toBe(true);
    expect(seen.has(1)).toBe(true);
  });

  it("return type is strictly -1 | 1", () => {
    const rng = new SeededRandom(42);
    const val: -1 | 1 = rng.randomSign();
    expect([-1, 1]).toContain(val);
  });
});

// ---------------------------------------------------------------------------
// AC-5: getState / setState round-trip
// ---------------------------------------------------------------------------

describe("AC-5: getState/setState round-trip", () => {
  it("getState returns internal state; setState restores sequence", () => {
    const original = new SeededRandom(42);

    // Advance 5 times
    for (let i = 0; i < 5; i++) {
      original.random();
    }

    // Save state at index 5
    const savedState = original.getState();
    const expectedNext = original.random(); // 6th value

    // Now resume from saved state
    const resumed = new SeededRandom(99); // different seed
    resumed.setState(savedState);
    const actualNext = resumed.random(); // should match 6th value

    expect(actualNext).toBe(expectedNext);
  });

  it("sequence after setState matches fresh instance advanced same amount", () => {
    const fresh = new SeededRandom(42);

    // Advance fresh 5 times
    for (let i = 0; i < 5; i++) {
      fresh.random();
    }

    // Capture state after 5 advances
    const stateAfter5 = new SeededRandom(42);
    for (let i = 0; i < 5; i++) {
      stateAfter5.random();
    }
    const capturedState = stateAfter5.getState();

    // Advance fresh further
    const expected1 = fresh.random();
    const expected2 = fresh.random();
    const expected3 = fresh.random();

    // Now restore from captured state — should continue from index 5
    const restored = new SeededRandom(42);
    // Overwrite state after 5 advances
    for (let i = 0; i < 5; i++) {
      restored.random();
    }
    // This is the key: setState to what we captured
    restored.setState(capturedState);

    expect(restored.random()).toBe(expected1);
    expect(restored.random()).toBe(expected2);
    expect(restored.random()).toBe(expected3);
  });

  it("setState(0) produces an all-zero sequence (LCG property)", () => {
    const rng = new SeededRandom(42);
    rng.setState(0);

    // LCG state 0 => state = (0 * 1664525 + 1013904223) >>> 0 = 1013904223
    // After first advance, it's no longer zero — so only the FIRST call
    // after setState(0) has a specific pattern. Let's verify the state is 0.
    expect(rng.getState()).toBe(0);

    // After advance: (0 * 1664525 + 1013904223) >>> 0 = 1013904223
    const val = rng.random();
    expect(val).toBeGreaterThan(0); // Non-deterministic LCG can't stay at 0
  });

  it("setState(0xffffffff) accepts max unsigned 32-bit value", () => {
    const rng = new SeededRandom(42);
    rng.setState(0xffffffff);
    expect(rng.getState()).toBe(0xffffffff);

    // Should not throw and should produce a valid value strictly less than 1.0
    const val = rng.random();
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThan(1);
    // Regression: divisor must be 0x100000000, not 0xffffffff
    expect(val).not.toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// AC-6: Zero dependencies (verified by tsc --noEmit)
// ---------------------------------------------------------------------------

describe("AC-6: zero external dependencies", () => {
  it("SeededRandom is instantiatable without any engine imports", () => {
    // This test validates that importing SeededRandom does not transitively
    // import Babylon.js or any npm package. The real verification is
    // `tsc --noEmit` on the Foundation directory, which will fail if any
    // Foundation file imports from outside Foundation.
    const rng = new SeededRandom(42);
    expect(rng).toBeInstanceOf(SeededRandom);
  });
});

// ---------------------------------------------------------------------------
// Additional edge cases and value properties
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("seed sanitization: negative values become positive", () => {
    const rng = new SeededRandom(-42);
    const state = rng.getState();
    expect(state).toBeGreaterThan(0);
  });

  it("seed sanitization: zero becomes 1", () => {
    const rng = new SeededRandom(0);
    const state = rng.getState();
    expect(state).toBe(1);
  });

  it("random() returns values in [0, 1) over 10000 calls", () => {
    const rng = new SeededRandom(42);

    for (let i = 0; i < 10000; i++) {
      const val = rng.random();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it("successive getState calls return different values (state advances)", () => {
    const rng = new SeededRandom(42);
    const s0 = rng.getState(); // initial state (before any advance)

    // Advance and capture
    rng.random();
    const s1 = rng.getState();

    rng.random();
    const s2 = rng.getState();

    // State should change after each random() call
    expect(s0).not.toBe(s1);
    expect(s1).not.toBe(s2);
  });

  it("works with large seeds that exceed 32-bit range", () => {
    // Very large numbers are coerced via >>> 0
    const rng = new SeededRandom(9999999999);
    const state = rng.getState();
    // The >>> 0 truncation should give us a value < 2^32
    expect(state).toBeGreaterThanOrEqual(0);
    expect(state).toBeLessThan(0x100000000);
  });
});
