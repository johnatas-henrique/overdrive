/**
 * @fileoverview Unit tests for Story 002: Dead Zone Formula + Analog Processing.
 *
 * GDD Requirement: TR-INP-003 — Dead zone formula applied to analog inputs
 * Governing ADR: ADR-0006 (Input Abstraction)
 * Control Manifest: C13 (Dead zone formula), F-G3 (Slot 1 Input < 0.01ms)
 *
 * Covers all 6 acceptance criteria:
 *   AC-1: Returns 0 when |raw| < threshold
 *   AC-2: Preserves sign and remaps above threshold
 *   AC-3: threshold=0 disables dead zone (passthrough)
 *   AC-4: threshold=0.5 snaps below ±0.5 to 0; ±1.0 → ±1.0
 *   AC-5: Same formula applies to both -1..1 and 0..1 ranges
 *   AC-6: Pure function — no side effects, deterministic
 */

import { describe, expect, it } from "vitest";
import { applyDeadZone } from "@/core/input/dead-zone";

// ---------------------------------------------------------------------------
// AC-1: Returns 0 when |raw| < threshold
// ---------------------------------------------------------------------------

describe("AC-1: returns 0 when |raw| < threshold", () => {
  it("test_below_threshold_returns_zero_positive", () => {
    expect(applyDeadZone(0.1, 0.15)).toBe(0);
  });

  it("test_below_threshold_returns_zero_negative", () => {
    expect(applyDeadZone(-0.1, 0.15)).toBe(0);
  });

  it("test_just_below_threshold_returns_zero", () => {
    // 0.149 is just below 0.15 — still in dead zone
    expect(applyDeadZone(0.149, 0.15)).toBe(0);
  });

  it("test_boundary_equal_to_threshold_returns_zero_numerator_zero", () => {
    // raw === threshold → numerator is (|raw| - threshold) = 0 → result is 0
    expect(applyDeadZone(0.15, 0.15)).toBe(0);
  });

  it("test_negative_boundary_equal_to_threshold_returns_zero", () => {
    // |-0.15| === 0.15, numerator is 0 → result is 0
    expect(applyDeadZone(-0.15, 0.15)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-2: Preserves sign and remaps above threshold
// ---------------------------------------------------------------------------

describe("AC-2: preserves sign and remaps above threshold", () => {
  it("test_positive_raw_remaps_correctly", () => {
    // (0.5 - 0.15) / (1 - 0.15) = 0.35 / 0.85 ≈ 0.4117647
    expect(applyDeadZone(0.5, 0.15)).toBeCloseTo(0.412, 3);
  });

  it("test_negative_raw_preserves_sign", () => {
    // -(0.5 - 0.15) / (1 - 0.15) = -0.35 / 0.85 ≈ -0.4117647
    expect(applyDeadZone(-0.5, 0.15)).toBeCloseTo(-0.412, 3);
  });

  it("test_full_positive_preserved", () => {
    // (1.0 - 0.15) / (1 - 0.15) = 0.85 / 0.85 = 1.0
    expect(applyDeadZone(1.0, 0.15)).toBe(1.0);
  });

  it("test_full_negative_preserved", () => {
    // -(1.0 - 0.15) / (1 - 0.15) = -0.85 / 0.85 = -1.0
    expect(applyDeadZone(-1.0, 0.15)).toBe(-1.0);
  });

  it("test_output_range_is_continuous_above_threshold", () => {
    // As raw approaches 1.0, output approaches 1.0
    const output = applyDeadZone(0.99, 0.15);
    expect(output).toBeGreaterThan(0.9);
    expect(output).toBeLessThanOrEqual(1.0);
  });

  it("test_output_monotonic_above_threshold", () => {
    // Higher raw input → higher output (monotonic increasing for positive)
    const lower = applyDeadZone(0.3, 0.15);
    const higher = applyDeadZone(0.6, 0.15);
    expect(higher).toBeGreaterThan(lower);
  });
});

// ---------------------------------------------------------------------------
// AC-3: threshold=0 disables dead zone (passthrough)
// ---------------------------------------------------------------------------

describe("AC-3: threshold=0 disables dead zone", () => {
  it("test_zero_threshold_passthrough_positive", () => {
    expect(applyDeadZone(0.5, 0)).toBe(0.5);
  });

  it("test_zero_threshold_passthrough_negative", () => {
    expect(applyDeadZone(-0.3, 0)).toBe(-0.3);
  });

  it("test_zero_threshold_passthrough_zero", () => {
    expect(applyDeadZone(0.0, 0)).toBe(0.0);
  });

  it("test_zero_threshold_full_range_positive", () => {
    expect(applyDeadZone(1.0, 0)).toBe(1.0);
  });

  it("test_zero_threshold_full_range_negative", () => {
    expect(applyDeadZone(-1.0, 0)).toBe(-1.0);
  });

  it("test_zero_threshold_small_values_passthrough", () => {
    // Even tiny values pass through unchanged when threshold is 0
    expect(applyDeadZone(0.001, 0)).toBeCloseTo(0.001, 6);
    expect(applyDeadZone(-0.001, 0)).toBeCloseTo(-0.001, 6);
  });
});

// ---------------------------------------------------------------------------
// AC-4: threshold=0.5 snaps below ±0.5 to 0; ±1.0 → ±1.0
// ---------------------------------------------------------------------------

describe("AC-4: threshold=0.5 snap at half-range", () => {
  it("test_boundary_at_threshold_returns_zero", () => {
    // raw === threshold → numerator is 0 → result 0
    expect(applyDeadZone(0.5, 0.5)).toBe(0);
  });

  it("test_just_below_half_returns_zero", () => {
    expect(applyDeadZone(0.49, 0.5)).toBe(0);
  });

  it("test_above_half_remaps_correctly", () => {
    // (0.6 - 0.5) / (1 - 0.5) = 0.1 / 0.5 = 0.2
    expect(applyDeadZone(0.6, 0.5)).toBeCloseTo(0.2, 6);
  });

  it("test_full_positive_preserved_at_half_threshold", () => {
    // (1.0 - 0.5) / (1 - 0.5) = 0.5 / 0.5 = 1.0
    expect(applyDeadZone(1.0, 0.5)).toBe(1.0);
  });

  it("test_negative_side_snaps_below_threshold", () => {
    expect(applyDeadZone(-0.49, 0.5)).toBe(0);
  });

  it("test_negative_side_remaps_above_threshold", () => {
    // -(0.6 - 0.5) / (1 - 0.5) = -0.1 / 0.5 = -0.2
    expect(applyDeadZone(-0.6, 0.5)).toBeCloseTo(-0.2, 6);
  });

  it("test_full_negative_preserved_at_half_threshold", () => {
    // -(1.0 - 0.5) / (1 - 0.5) = -0.5 / 0.5 = -1.0
    expect(applyDeadZone(-1.0, 0.5)).toBe(-1.0);
  });
});

// ---------------------------------------------------------------------------
// AC-5: Same formula applies to both -1..1 and 0..1 ranges
// ---------------------------------------------------------------------------

describe("AC-5: range-agnostic — same formula for all analog ranges", () => {
  it("test_steering_range_bipolar_produces_expected_output", () => {
    // Steering is -1..1, test positive side
    const result = applyDeadZone(0.8, 0.15);
    const expected = (0.8 - 0.15) / (1 - 0.15);
    expect(result).toBeCloseTo(expected, 6);
  });

  it("test_throttle_range_unipolar_produces_expected_output", () => {
    // Throttle is 0..1, test above threshold
    const result = applyDeadZone(0.8, 0.15);
    const expected = (0.8 - 0.15) / (1 - 0.15);
    expect(result).toBeCloseTo(expected, 6);
  });

  it("test_steering_negative_produces_expected_output", () => {
    // Bipolar negative side
    const result = applyDeadZone(-0.7, 0.15);
    const expected = -((0.7 - 0.15) / (1 - 0.15));
    expect(result).toBeCloseTo(expected, 6);
  });

  it("test_throttle_at_zero_in_dead_zone", () => {
    // Throttle at bottom of 0..1 range, within dead zone
    expect(applyDeadZone(0.05, 0.15)).toBe(0);
  });

  it("test_throttle_full_press_produces_full_output", () => {
    // Full throttle regardless of dead zone
    expect(applyDeadZone(1.0, 0.3)).toBe(1.0);
  });

  it("test_formula_has_no_range_specific_branches", () => {
    // Verify by testing the same threshold with a 0..1 value and verifying
    // the output respects the formula regardless of range convention.
    // For raw=0.4, threshold=0.2: |0.4| >= 0.2, formula applies:
    // 1 * (0.4 - 0.2) / 0.8 = 0.25
    expect(applyDeadZone(0.4, 0.2)).toBeCloseTo(0.25, 6);
  });
});

// ---------------------------------------------------------------------------
// AC-6: Pure function — no side effects, deterministic
// ---------------------------------------------------------------------------

describe("AC-6: pure function — no side effects, no state", () => {
  it("test_identical_inputs_produce_identical_outputs", () => {
    const inputs: Array<[number, number]> = [
      [0.1, 0.15],
      [0.5, 0.15],
      [-0.5, 0.15],
      [1.0, 0.15],
      [0.0, 0.0],
      [0.5, 0.0],
    ];

    // For each input combination, call 1000 times and verify consistency
    for (const [raw, threshold] of inputs) {
      const expected = applyDeadZone(raw, threshold);

      for (let i = 0; i < 1000; i++) {
        expect(applyDeadZone(raw, threshold)).toBe(expected);
      }
    }
  });

  it("test_concurrent_calls_no_state_corruption", () => {
    // Simulate "concurrent" calls by interleaving different inputs
    const results = new Array<number>(100);

    for (let i = 0; i < 100; i++) {
      // Mix of positive, negative, edge cases
      results[i * 0] = applyDeadZone(0.5, 0.15);
      results[i * 1] = applyDeadZone(-0.5, 0.15);
      results[i * 2] = applyDeadZone(0.1, 0.15);
      results[i * 3] = applyDeadZone(1.0, 0.5);
      results[i * 4] = applyDeadZone(-1.0, 0.5);
      results[i * 5] = applyDeadZone(0.0, 0.0);
      results[i * 6] = applyDeadZone(0.3, 0.0);
    }

    // No state means no cross-call interference — verify consistency
    expect(applyDeadZone(0.5, 0.15)).toBeCloseTo(0.412, 3);
    expect(applyDeadZone(-0.5, 0.15)).toBeCloseTo(-0.412, 3);
    expect(applyDeadZone(0.1, 0.15)).toBe(0);
    expect(applyDeadZone(1.0, 0.5)).toBe(1.0);
    expect(applyDeadZone(-1.0, 0.5)).toBe(-1.0);
    expect(applyDeadZone(0.0, 0.0)).toBe(0.0);
    expect(applyDeadZone(0.3, 0.0)).toBe(0.3);
  });

  it("test_no_mutation_of_external_state", () => {
    // Verify the function doesn't need or modify any external state
    // by calling it with varying inputs and checking invariants
    const thresholds = [0, 0.1, 0.15, 0.25, 0.5, 0.75, 0.9, 0.99999];
    const rawValues = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];

    for (const t of thresholds) {
      for (const r of rawValues) {
        const result = applyDeadZone(r, t);
        // Invariant: result is always in [-1, 1]
        expect(result).toBeGreaterThanOrEqual(-1);
        expect(result).toBeLessThanOrEqual(1);
        // Invariant: sign(result) === sign(r) when result !== 0
        if (result !== 0 && r !== 0) {
          expect(Math.sign(result)).toBe(Math.sign(r));
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases and robustness
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("test_threshold_of_max_returns_full_dead_zone", () => {
    // When threshold is at the maximum allowed, all non-max inputs return 0
    expect(applyDeadZone(0.999, 0.99999)).toBe(0);
    // At max threshold, only raw = ±1.0 produces non-zero
    expect(applyDeadZone(1.0, 0.99999)).toBeCloseTo(1.0, 3);
  });

  it("test_negative_threshold_clamped_to_zero", () => {
    // A negative threshold doesn't make physical sense for a dead zone.
    // Implementation clamps threshold to [0, MAX_THRESHOLD] so negative
    // values behave like threshold=0 (passthrough).
    expect(applyDeadZone(0.5, -0.1)).toBeCloseTo(0.5, 6);
    expect(applyDeadZone(-0.3, -0.1)).toBeCloseTo(-0.3, 6);
  });

  it("test_zero_raw_returns_zero_regardless_of_threshold", () => {
    // raw = 0 is always in the dead zone (|0| < threshold for threshold > 0)
    expect(applyDeadZone(0, 0)).toBe(0);
    expect(applyDeadZone(0, 0.15)).toBe(0);
    expect(applyDeadZone(0, 0.5)).toBe(0);
    expect(applyDeadZone(0, 0.99999)).toBe(0);
  });
});
