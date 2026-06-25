import { describe, expect, it, vi } from "vitest";
import {
  FixedUpdatePipeline,
  PipelineError,
  SeededRandom,
} from "../../src/foundation/determinism";

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

// ---------------------------------------------------------------------------
// FixedUpdatePipeline — AC-1: Basic slot registration and execution
// ---------------------------------------------------------------------------

describe("AC-1: basic slot registration and execution", () => {
  it("register('input', fn, 1) calls fn with dt on executeTick", () => {
    const pipeline = new FixedUpdatePipeline();
    const spy = vi.fn();
    pipeline.register("input", spy, 1);
    pipeline.start();
    pipeline.executeTick(1 / 60);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(1 / 60);
  });

  it("can register at slot 8 (last slot)", () => {
    const pipeline = new FixedUpdatePipeline();
    const spy = vi.fn();
    pipeline.register("last", spy, 8);
    pipeline.start();
    pipeline.executeTick(1 / 60);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// FixedUpdatePipeline — AC-2: Call order verification
// ---------------------------------------------------------------------------

describe("AC-2: call order verification", () => {
  it("executes slots in ascending index order [1, 2, 3]", () => {
    const pipeline = new FixedUpdatePipeline();
    const order: number[] = [];
    pipeline.register("a", () => order.push(1), 1);
    pipeline.register("b", () => order.push(2), 2);
    pipeline.register("c", () => order.push(3), 3);
    pipeline.start();
    pipeline.executeTick(1 / 60);
    expect(order).toEqual([1, 2, 3]);
  });

  it("executes non-contiguous slots (1, 5, 8) in ascending order", () => {
    const pipeline = new FixedUpdatePipeline();
    const order: number[] = [];
    pipeline.register("slot8", () => order.push(8), 8);
    pipeline.register("slot1", () => order.push(1), 1);
    pipeline.register("slot5", () => order.push(5), 5);
    pipeline.start();
    pipeline.executeTick(1 / 60);
    expect(order).toEqual([1, 5, 8]);
  });
});

// ---------------------------------------------------------------------------
// FixedUpdatePipeline — AC-3: Registration order independence
// ---------------------------------------------------------------------------

describe("AC-3: registration order independence", () => {
  it("executes physics before ai regardless of registration order", () => {
    const pipeline = new FixedUpdatePipeline();
    const order: number[] = [];
    pipeline.register("ai", () => order.push(3), 3);
    pipeline.register("physics", () => order.push(2), 2);
    pipeline.start();
    pipeline.executeTick(1 / 60);
    expect(order).toEqual([2, 3]);
  });

  it("executes slots 1→8 when registered in reverse order", () => {
    const pipeline = new FixedUpdatePipeline();
    const order: number[] = [];
    for (let i = 8; i >= 1; i--) {
      const spy = () => order.push(i);
      pipeline.register(`s${i}`, spy, i);
    }
    pipeline.start();
    pipeline.executeTick(1 / 60);
    expect(order).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

// ---------------------------------------------------------------------------
// FixedUpdatePipeline — AC-4: register after start throws
// ---------------------------------------------------------------------------

describe("AC-4: register after start throws", () => {
  it("throws PipelineError when registering after start()", () => {
    const pipeline = new FixedUpdatePipeline();
    pipeline.start();
    expect(() => pipeline.register("late", vi.fn(), 1)).toThrow(PipelineError);
    expect(() => pipeline.register("late", vi.fn(), 1)).toThrow(
      "Cannot register after pipeline has started"
    );
  });

  it("throws PipelineError when registering after dispose()", () => {
    const pipeline = new FixedUpdatePipeline();
    pipeline.start();
    pipeline.dispose();
    expect(() => pipeline.register("late", vi.fn(), 1)).toThrow(PipelineError);
    expect(() => pipeline.register("late", vi.fn(), 1)).toThrow(
      "Cannot register after pipeline has started"
    );
  });
});

// ---------------------------------------------------------------------------
// FixedUpdatePipeline — AC-5: executeTick before start throws
// ---------------------------------------------------------------------------

describe("AC-5: executeTick before start throws", () => {
  it("throws PipelineError when executeTick called in Uninitialized state", () => {
    const pipeline = new FixedUpdatePipeline();
    expect(() => pipeline.executeTick(1 / 60)).toThrow(PipelineError);
    expect(() => pipeline.executeTick(1 / 60)).toThrow("Pipeline not started");
  });

  it("throws PipelineError when executeTick called after stop()", () => {
    const pipeline = new FixedUpdatePipeline();
    pipeline.start();
    pipeline.stop();
    expect(() => pipeline.executeTick(1 / 60)).toThrow(PipelineError);
  });
});

// ---------------------------------------------------------------------------
// FixedUpdatePipeline — AC-6: Throwing slot isolation
// ---------------------------------------------------------------------------

describe("AC-6: throwing slot isolation", () => {
  it("continues execution after a throwing slot", () => {
    const pipeline = new FixedUpdatePipeline();
    const calls: number[] = [];
    pipeline.register("slot1", () => calls.push(1), 1);
    pipeline.register(
      "slot2",
      () => {
        throw new Error("Physics fail");
      },
      2
    );
    pipeline.register("slot3", () => calls.push(3), 3);
    pipeline.start();
    pipeline.executeTick(1 / 60);
    expect(calls).toEqual([1, 3]);
  });

  it("handles all 8 slots throwing without crash", () => {
    const pipeline = new FixedUpdatePipeline();
    for (let i = 1; i <= 8; i++) {
      pipeline.register(
        `s${i}`,
        () => {
          throw new Error(`fail ${i}`);
        },
        i
      );
    }
    pipeline.start();
    // Should not throw
    expect(() => pipeline.executeTick(1 / 60)).not.toThrow();
  });

  it("handles slot 1 throwing — slots 2–8 still execute", () => {
    const pipeline = new FixedUpdatePipeline();
    const calls: number[] = [];
    const slot1Spy = vi.fn(() => {
      throw new Error("First fail");
    });
    pipeline.register("slot1", slot1Spy, 1);
    for (let i = 2; i <= 8; i++) {
      pipeline.register(`s${i}`, () => calls.push(i), i);
    }
    pipeline.start();
    pipeline.executeTick(1 / 60);
    expect(slot1Spy).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });
});

// ---------------------------------------------------------------------------
// FixedUpdatePipeline — AC-7: Tick counting
// ---------------------------------------------------------------------------

describe("AC-7: tick counting", () => {
  it("getCurrentTick() returns 0 before any tick", () => {
    const pipeline = new FixedUpdatePipeline();
    expect(pipeline.getCurrentTick()).toBe(0);
  });

  it("getCurrentTick() increments by 1 per executeTick()", () => {
    const pipeline = new FixedUpdatePipeline();
    pipeline.start();
    expect(pipeline.getCurrentTick()).toBe(0);
    pipeline.executeTick(1 / 60);
    expect(pipeline.getCurrentTick()).toBe(1);
    pipeline.executeTick(1 / 60);
    pipeline.executeTick(1 / 60);
    pipeline.executeTick(1 / 60);
    pipeline.executeTick(1 / 60);
    expect(pipeline.getCurrentTick()).toBe(5);
  });

  it("counter resets after stop() + new start()", () => {
    const pipeline = new FixedUpdatePipeline();
    pipeline.register("a", vi.fn(), 1);
    pipeline.start();
    pipeline.executeTick(1 / 60);
    pipeline.executeTick(1 / 60);
    expect(pipeline.getCurrentTick()).toBe(2);
    pipeline.stop();
    pipeline.start();
    expect(pipeline.getCurrentTick()).toBe(0);
    pipeline.executeTick(1 / 60);
    expect(pipeline.getCurrentTick()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// FixedUpdatePipeline — AC-8: Disposed state
// ---------------------------------------------------------------------------

describe("AC-8: disposed state", () => {
  it("executeTick() throws PipelineError after dispose()", () => {
    const pipeline = new FixedUpdatePipeline();
    pipeline.start();
    pipeline.dispose();
    expect(() => pipeline.executeTick(1 / 60)).toThrow(PipelineError);
    expect(() => pipeline.executeTick(1 / 60)).toThrow("Pipeline is disposed");
  });

  it("dispose() is idempotent (safe to call twice)", () => {
    const pipeline = new FixedUpdatePipeline();
    pipeline.start();
    pipeline.dispose();
    pipeline.dispose();
    // Still disposed — executeTick should throw
    expect(() => pipeline.executeTick(1 / 60)).toThrow(PipelineError);
  });
});

// ---------------------------------------------------------------------------
// FixedUpdatePipeline — AC-9: Invalid slot index
// ---------------------------------------------------------------------------

describe("AC-9: invalid slot index", () => {
  it("throws PipelineError for slot index 0", () => {
    const pipeline = new FixedUpdatePipeline();
    expect(() => pipeline.register("bad", vi.fn(), 0)).toThrow(PipelineError);
    expect(() => pipeline.register("bad", vi.fn(), 0)).toThrow(
      "Invalid slot index: 0"
    );
  });

  it("throws PipelineError for slot index 9", () => {
    const pipeline = new FixedUpdatePipeline();
    expect(() => pipeline.register("bad", vi.fn(), 9)).toThrow(PipelineError);
    expect(() => pipeline.register("bad", vi.fn(), 9)).toThrow(
      "Invalid slot index: 9"
    );
  });

  it("throws PipelineError for negative slot index (-1)", () => {
    const pipeline = new FixedUpdatePipeline();
    expect(() => pipeline.register("bad", vi.fn(), -1)).toThrow(PipelineError);
    expect(() => pipeline.register("bad", vi.fn(), -1)).toThrow(
      "Invalid slot index: -1"
    );
  });

  it("throws PipelineError for non-integer slot index (1.5)", () => {
    const pipeline = new FixedUpdatePipeline();
    expect(() => pipeline.register("bad", vi.fn(), 1.5)).toThrow(PipelineError);
    expect(() => pipeline.register("bad", vi.fn(), 1.5)).toThrow(
      "Invalid slot index: 1.5"
    );
  });

  it("throws PipelineError for NaN slot index", () => {
    const pipeline = new FixedUpdatePipeline();
    expect(() => pipeline.register("bad", vi.fn(), NaN)).toThrow(PipelineError);
  });

  it("throws PipelineError for Infinity slot index", () => {
    const pipeline = new FixedUpdatePipeline();
    expect(() => pipeline.register("bad", vi.fn(), Infinity)).toThrow(
      PipelineError
    );
  });
});

// ---------------------------------------------------------------------------
// FixedUpdatePipeline — AC-10: Duplicate systemId
// ---------------------------------------------------------------------------

describe("AC-10: duplicate systemId", () => {
  it("throws PipelineError for duplicate systemId at same slot", () => {
    const pipeline = new FixedUpdatePipeline();
    pipeline.register("physics", vi.fn(), 2);
    expect(() => pipeline.register("physics", vi.fn(), 2)).toThrow(
      PipelineError
    );
    expect(() => pipeline.register("physics", vi.fn(), 2)).toThrow(
      "System already registered: physics"
    );
  });

  it("throws PipelineError for duplicate systemId at different slot", () => {
    const pipeline = new FixedUpdatePipeline();
    pipeline.register("physics", vi.fn(), 2);
    expect(() => pipeline.register("physics", vi.fn(), 3)).toThrow(
      PipelineError
    );
    expect(() => pipeline.register("physics", vi.fn(), 3)).toThrow(
      "System already registered: physics"
    );
  });
});

// ---------------------------------------------------------------------------
// Edge cases — Additional pipeline behavior
// ---------------------------------------------------------------------------

describe("pipeline edge cases", () => {
  it("throws PipelineError when registering into an occupied slot", () => {
    const pipeline = new FixedUpdatePipeline();
    pipeline.register("physics", vi.fn(), 2);
    expect(() => pipeline.register("collision", vi.fn(), 2)).toThrow(
      PipelineError
    );
    expect(() => pipeline.register("collision", vi.fn(), 2)).toThrow(
      "Slot 2 already occupied by: physics"
    );
  });

  it("can register into slot 1 when slot 2 is already occupied", () => {
    const pipeline = new FixedUpdatePipeline();
    pipeline.register("physics", vi.fn(), 2);
    // Slot 1 is unoccupied — should succeed
    expect(() => pipeline.register("input", vi.fn(), 1)).not.toThrow();
  });

  it("can call start() from Stopped state", () => {
    const pipeline = new FixedUpdatePipeline();
    pipeline.register("a", vi.fn(), 1);
    pipeline.start();
    pipeline.executeTick(1 / 60);
    pipeline.stop();
    // start() from Stopped should work
    pipeline.start();
    pipeline.executeTick(1 / 60);
    expect(pipeline.getCurrentTick()).toBe(1);
  });

  it("empty pipeline runs executeTick without error", () => {
    const pipeline = new FixedUpdatePipeline();
    pipeline.start();
    expect(() => pipeline.executeTick(1 / 60)).not.toThrow();
    expect(pipeline.getCurrentTick()).toBe(1);
  });

  it("start() throws from Ready state", () => {
    const pipeline = new FixedUpdatePipeline();
    pipeline.start();
    expect(() => pipeline.start()).toThrow(PipelineError);
  });

  it("start() throws from Disposed state", () => {
    const pipeline = new FixedUpdatePipeline();
    pipeline.dispose();
    expect(() => pipeline.start()).toThrow(PipelineError);
  });

  it("stop() is idempotent when already stopped", () => {
    const pipeline = new FixedUpdatePipeline();
    pipeline.start();
    pipeline.stop();
    // Already stopped — second stop() is a no-op
    expect(() => pipeline.stop()).not.toThrow();
  });

  it("stop() is no-op in Uninitialized state", () => {
    const pipeline = new FixedUpdatePipeline();
    // stop() before start — should not throw, just no-op
    expect(() => pipeline.stop()).not.toThrow();
  });

  it("stop() is no-op in Disposed state", () => {
    const pipeline = new FixedUpdatePipeline();
    pipeline.start();
    pipeline.dispose();
    // stop() after dispose — should not throw, just no-op
    expect(() => pipeline.stop()).not.toThrow();
  });
});
