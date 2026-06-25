/**
 * Fixed timestep accumulator — pure function for deterministic simulation stepping.
 *
 * Processes a frame delta against a fixed timestep accumulator, producing
 * the number of simulation ticks to execute. Implements spiral-of-death
 * protection by capping at {@link MAX_CATCHUP} (4) ticks per frame and clamping
 * the remaining accumulator to 0 if it still exceeds {@link FIXED_DT}.
 *
 * Zero Babylon.js APIs — pure TypeScript math.
 *
 * ## Design
 *
 * The accumulator decouples simulation rate (60 Hz) from render rate (variable).
 * Each frame, the elapsed wall time (`frameDelta`) is clamped, negated values
 * are zeroed, and the result is added to the accumulator. As many fixed-duration
 * ticks as possible are consumed (up to the cap), and the remainder carries
 * forward for the next frame's rendering interpolation.
 *
 * ## Spiral-of-Death Protection
 *
 * If the render loop falls behind (tab backgrounded, heavy load), the
 * accumulator could grow unboundedly, causing a "spiral of death" where each
 * frame must simulate more ticks than wall time allows. This function caps
 * both the frame delta (at {@link MAX_FRAME_DELTA}) and the tick count (at
 * {@link MAX_CATCHUP}), clamping any remaining accumulator to 0 after max
 * catch-up.
 *
 * @see ADR-0002 — Fixed Timestep & Determinism Pipeline
 * @see F13 — Fixed timestep at 1/60s, accumulator-driven from engine.getDeltaTime()
 * @see F14 — Max 4 catch-up ticks, spiral-of-death protection
 */

/**
 * Result of a single accumulator processing step.
 *
 * @example
 * ```typescript
 * const { ticks, newAccumulator, clamped } = accumulate(0, 1 / 60);
 * // ticks: 1, newAccumulator: 0, clamped: false
 * ```
 */
export interface TickResult {
  /** Number of simulation ticks to execute (0 … MAX_CATCHUP). */
  readonly ticks: number;
  /** Remaining time (in seconds) for the next frame's accumulator carry-over. */
  readonly newAccumulator: number;
  /** True if the spiral-of-death clamp fired (accumulator was forced to 0). */
  readonly clamped: boolean;
}

/** Fixed timestep duration in seconds: 1/60 ≈ 16.667ms. */
export const FIXED_DT = 1 / 60;

/**
 * Maximum number of catch-up ticks per frame.
 *
 * Prevents spiral-of-death by capping simulation work per render frame.
 */
export const MAX_CATCHUP = 4;

/**
 * Maximum frame delta in seconds (1 second).
 *
 * Values larger than this are clamped to prevent huge accumulator growth
 * when the tab is backgrounded or the frame budget is severely exceeded.
 */
export const MAX_FRAME_DELTA = 1.0;

/**
 * Process a frame delta through the fixed timestep accumulator.
 *
 * **Processing order:**
 * 1. Clamp `frameDelta` to {@link MAX_FRAME_DELTA} — prevent huge accumulator
 *    on tab background or long frames.
 * 2. Clamp negative `frameDelta` to 0 — time cannot flow backwards.
 * 3. Add the safe delta to `currentAccumulator`.
 * 4. Consume as many fixed-duration ticks as possible, up to
 *    {@link MAX_CATCHUP}.
 * 5. If still enough for a tick after max catch-up, clamp accumulator to 0
 *    and set `clamped = true` (spiral-of-death).
 *
 * @param currentAccumulator - Accumulated time from previous frames (seconds).
 * @param frameDelta - Elapsed wall time for this frame (seconds).
 * @returns A {@link TickResult} with the number of ticks to execute and the
 *   new accumulator value.
 *
 * @example
 * ```typescript
 * // Normal frame: exactly one tick
 * accumulate(0, 1 / 60);
 * // → { ticks: 1, newAccumulator: 0, clamped: false }
 *
 * // Large frame (capped at 4 ticks + spiral clamp)
 * accumulate(0, 5 / 60);
 * // → { ticks: 4, newAccumulator: 0, clamped: true }
 *
 * // Zero delta: no ticks, unchanged accumulator
 * accumulate(0, 0);
 * // → { ticks: 0, newAccumulator: 0, clamped: false }
 * ```
 */
export function accumulate(
  currentAccumulator: number,
  frameDelta: number
): TickResult {
  // Defensive: NaN/Infinity input — return unchanged accumulator
  if (!Number.isFinite(frameDelta) || !Number.isFinite(currentAccumulator)) {
    return { ticks: 0, newAccumulator: currentAccumulator, clamped: false };
  }

  // 1. Clamp frameDelta to MAX_FRAME_DELTA — prevent huge accumulator growth
  const clampedDelta = Math.min(frameDelta, MAX_FRAME_DELTA);

  // 2. Clamp negative delta to 0 — time cannot flow backwards
  const safeDelta = Math.max(0, clampedDelta);

  // 3. Accumulate
  let accumulator = currentAccumulator + safeDelta;
  let ticks = 0;
  let clamped = false;

  // 4. Consume ticks (up to MAX_CATCHUP)
  while (accumulator >= FIXED_DT && ticks < MAX_CATCHUP) {
    accumulator -= FIXED_DT;
    ticks++;
  }

  // 5. Spiral-of-death: if still enough for ≥1 tick, clamp accumulator to 0
  if (accumulator >= FIXED_DT) {
    accumulator = 0;
    clamped = true;
  }

  return { ticks, newAccumulator: accumulator, clamped };
}
