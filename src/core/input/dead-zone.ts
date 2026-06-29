/**
 * @fileoverview Dead zone formula for analog input axes.
 *
 * GDD Requirement: TR-INP-003 — Dead zone formula applied to analog inputs:
 *   `output = |raw| < threshold ? 0 : sign(raw) × (|raw| - threshold) / (1 - threshold)`
 *
 * Governing ADR: ADR-0006 (Input Abstraction)
 * Control Manifest: C13 (Dead zone formula), F-G3 (Slot 1 Input < 0.01ms)
 *
 * This is a pure math utility — zero Babylon.js imports, zero state, zero side effects.
 * Designed to be called per tick for each analog axis (steer, throttle, brake).
 *
 * @remarks
 * Performance: single multiply-add in the hot path. Estimated < 0.001ms per call
 * on modern CPUs. Well within the Slot 1 (Input) budget of < 0.01ms per tick.
 *
 * @module
 */

/**
 * Maximum allowed threshold value to prevent division-by-zero in the denormalizing
 * term `(1 - threshold)`. When `threshold >= MAX_THRESHOLD`, the function returns 0
 * for all inputs (full dead zone).
 */
const MAX_THRESHOLD = 0.99999;

export function applyDeadZone(raw: number, threshold: number): number {
  // Clamp threshold to [0, MAX_THRESHOLD] — negative thresholds don't make
  // physical sense for a dead zone and would amplify small inputs.
  const t = Math.min(MAX_THRESHOLD, Math.max(0, threshold));
  const absRaw = Math.abs(raw);

  // Below threshold → zero (in the dead zone)
  if (absRaw < t) {
    return 0;
  }

  // Above threshold → remap preserving sign.
  // Formula: sign(raw) × (|raw| - threshold) / (1 - threshold)
  // Use `|| 0` to convert -0 to +0 (JS quirk: -1 * 0 = -0)
  return Math.sign(raw) * ((absRaw - t) / (1 - t)) || 0;
}
