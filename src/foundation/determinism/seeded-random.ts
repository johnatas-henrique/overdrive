/**
 * Deterministic pseudorandom number generator using LCG (Linear Congruential Generator).
 *
 * Uses Numerical Recipes constants (1664525, 1013904223) for the LCG algorithm.
 * Not cryptographically secure — intended for gameplay determinism only.
 *
 * Features:
 * - Identical sequences across all platforms for the same seed
 * - `random()`, `randomRange(min, max)`, `randomSign()` methods
 * - Snapshot support via `getState()` / `setState()` for replay
 * - Seed sanitization: negative → absolute value, 0 → 1
 *
 * ## Design Decisions
 *
 * - **Unsigned 32-bit truncation via `>>> 0`**: JavaScript's bitwise operators
 *   operate on signed 32-bit integers. `>>> 0` coerces to unsigned 32-bit,
 *   ensuring identical sequences across all platforms (x86, ARM, etc.).
 *   `Math.imul` is not used because the multiplicands fit in 32 bits and
 *   `>>> 0` handles the overflow correctly.
 * - **Division by `0x100000000`** (2³²): Maps the full unsigned 32-bit range [0, 2³²-1]
 *   to [0, 1). This gives maximum precision for the output float.
 * - **No `randomInt()` method**: Not in scope for this story. Use
 *   `Math.floor(randomRange(min, max + 1))` if integer range is needed.
 *
 * @see ADR-0002 — Fixed Timestep & Determinism Pipeline
 * @see F16 — SeededRandom LCG with constants 1664525, 1013904223
 */
export class SeededRandom {
  /** Internal LCG state — unsigned 32-bit integer. */
  private _state: number;

  /**
   * Create a new SeededRandom instance.
   *
   * Seed sanitization rules:
   * - Negative seed → `Math.abs(seed)` (producing a positive seed)
   * - Zero seed → 1 (LCG seed 0 produces an all-zero sequence, which
   *   is technically deterministic but useless for gameplay)
   * - Positive non-zero seed → used as-is
   *
   * @param seed - Initial seed value. Clamped to valid unsigned 32-bit range.
   *
   * @example
   * ```typescript
   * const rng = new SeededRandom(42);
   * const rngFromNegative = new SeededRandom(-42); // treated as seed 42
   * const rngFromZero = new SeededRandom(0);       // treated as seed 1
   * ```
   */
  constructor(seed: number) {
    // Negative → absolute value; zero → 1 (LCG degeneracy avoidance)
    const sanitized = seed <= 0 ? (seed === 0 ? 1 : Math.abs(seed)) : seed;
    this._state = sanitized >>> 0;
  }

  /**
   * Generate the next pseudorandom float in [0, 1).
   *
   * Advances the LCG state using the Numerical Recipes formula:
   * `state = (state * 1664525 + 1013904223) >>> 0`
   *
   * The result is the current state divided by `0xffffffff`, producing
   * a float in the range [0, 1) with uniform distribution.
   *
   * @returns A float in [0, 1)
   *
   * @example
   * ```typescript
   * const rng = new SeededRandom(42);
   * const value = rng.random(); // e.g. 0.607...
   * ```
   */
  random(): number {
    this._state = (this._state * 1664525 + 1013904223) >>> 0;
    return this._state / 0x100000000;
  }

  /**
   * Generate a pseudorandom float in [min, max).
   *
   * If `min > max`, the arguments are swapped to ensure a valid range.
   * If `min === max`, the function always returns that value.
   *
   * @param min - Lower bound of the range (inclusive)
   * @param max - Upper bound of the range (exclusive)
   * @returns A float in [min, max)
   *
   * @example
   * ```typescript
   * const rng = new SeededRandom(42);
   * const speed = rng.randomRange(200, 350); // random speed in 200..350
   * const zero = rng.randomRange(0, 0);      // always 0
   * ```
   */
  randomRange(min: number, max: number): number {
    if (min > max) {
      // Swap to maintain [min, max) contract
      const tmp = min;
      min = max;
      max = tmp;
    }
    if (min === max) {
      return min;
    }
    return min + this.random() * (max - min);
  }

  /**
   * Return -1 or 1 with equal probability (50/50).
   *
   * Uses `random() < 0.5` as the decision threshold. With a well-distributed
   * LCG, this produces approximately equal counts over a large sample.
   *
   * @returns -1 or 1
   *
   * @example
   * ```typescript
   * const rng = new SeededRandom(42);
   * const sign = rng.randomSign(); // -1 or 1
   * ```
   */
  randomSign(): -1 | 1 {
    return this.random() < 0.5 ? -1 : 1;
  }

  /**
   * Get the current internal state for serialization / snapshot.
   *
   * Combined with `setState()`, this enables SimulationSnapshot to save
   * and restore the RNG state, ensuring deterministic replay.
   *
   * @returns The current unsigned 32-bit LCG state value
   *
   * @example
   * ```typescript
   * const rng = new SeededRandom(42);
   * rng.random(); // advance
   * const snapshot = rng.getState(); // capture
   * // ... later ...
   * rng.setState(snapshot);          // restore
   * rng.random(); // same sequence continues from snapshot point
   * ```
   */
  getState(): number {
    return this._state;
  }

  /**
   * Restore the internal state from a previously captured snapshot.
   *
   * After calling `setState(state)`, the next `random()` call produces the
   * value that would have followed the `getState()` call that captured `state`.
   *
   * The provided state is coerced to unsigned 32-bit via `>>> 0` to ensure
   * any number (including negative or out-of-range values) is safely stored.
   *
   * @param state - A previously captured state value (or any number)
   *   Coerced to unsigned 32-bit internally.
   *
   * @example
   * ```typescript
   * const rng = new SeededRandom(42);
   * rng.random();                   // advance
   * const state = rng.getState();   // save
   * rng.random();                   // advance further
   * rng.setState(state);            // rewind
   * const replay = rng.random();    // same as the value after getState()
   * ```
   */
  setState(state: number): void {
    this._state = state >>> 0;
  }
}
