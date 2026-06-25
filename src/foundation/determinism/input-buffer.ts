/**
 * Double-buffered input state container for the deterministic pipeline.
 *
 * Ensures input values are consumed exactly once per tick and do not leak
 * across ticks. The pipeline lifecycle:
 *
 * 1. Slot #1 (Input) → `write(getState())` — hardware snapshot
 * 2. Slots #2–8 → `read()` — consumed deterministically
 * 3. After slot #8 → `flip()` — toggle buffers for next tick
 *
 * ## Edge Cases
 *
 * - `read()` before any `write()` returns `InputState.ZERO` — no stale input
 * - Multiple `write()` calls before `flip()` — last write wins
 * - `flip()` clears the new write buffer to `null`, isolating ticks
 * - `read()` is non-destructive — multiple calls return the same value
 *
 * ## Memory
 *
 * Two `InputState | null` references (~16 bytes in V8) plus a single
 * integer for the write index. No allocations in hot paths after init.
 *
 * @see ADR-0002 — Fixed Timestep & Determinism Pipeline, Input Buffering section
 * @see F12 — Pipeline slot order: Input is slot #1
 * @see F-G2 — Pipeline overhead < 0.001ms per tick
 *
 * @example
 * ```typescript
 * const buffer = new InputBuffer();
 *
 * // Tick N
 * buffer.write({ steer: 0.5, throttle: 1, brake: 0, gearDelta: 0,
 *   confirm: false, pauseToggle: false, cameraToggle: false,
 *   cancel: false, navUp: false, navDown: false });
 * const tickNState = buffer.read();
 * buffer.flip();
 *
 * // Tick N+1 (no write — uses ZERO)
 * const tickNp1State = buffer.read(); // InputState.ZERO
 * ```
 */

import { InputState } from "./types";

export class InputBuffer {
  /**
   * Two alternating buffers for double-buffering.
   * `null` indicates the buffer has not been written to this tick.
   * Index 0 and 1 alternate based on `_writeIndex`.
   */
  private _buffers: [InputState | null, InputState | null] = [null, null];

  /**
   * Index of the active write buffer (0 or 1).
   * Toggled via XOR in `flip()` after each tick's slot execution completes.
   */
  private _writeIndex = 0;

  /**
   * Store input state for the current tick.
   *
   * Called by pipeline slot #1 (Input) with the latest hardware snapshot.
   * Multiple writes before `flip()` are permitted — the last write wins
   * (overwrites the buffer at `_buffers[_writeIndex]`).
   *
   * @param state - Complete input state snapshot for this tick
   *
   * @example
   * ```typescript
   * buffer.write({
   *   steer: 0.5, throttle: 1, brake: 0, gearDelta: 0,
   *   confirm: false, pauseToggle: false, cameraToggle: false,
   *   cancel: false, navUp: false, navDown: false,
   * });
   * ```
   */
  write(state: InputState): void {
    this._buffers[this._writeIndex] = state;
  }

  /**
   * Read the current tick's input state.
   *
   * Called by pipeline slots #2–8. Returns the state most recently written
   * via `write()` in this tick, or `InputState.ZERO` if no write has occurred.
   * Non-destructive — safe to call multiple times in the same tick; each
   * call returns the same value.
   *
   * @returns The current tick's `InputState`, or `InputState.ZERO` if
   *   the active buffer has not been written to this tick
   *
   * @example
   * ```typescript
   * const state = buffer.read();
   * // state.steer is in [-1, 1], state.throttle in [0, 1], etc.
   * ```
   */
  read(): InputState {
    return this._buffers[this._writeIndex] ?? InputState.ZERO;
  }

  /**
   * Advance to the next tick's buffer.
   *
   * Toggles the write index (0 ↔ 1 via XOR) and clears the new write buffer
   * to `null`. This isolates the previous tick's data — the next `read()`
   * before `write()` will return `InputState.ZERO`.
   *
   * Called by the pipeline after all 8 slots have completed execution for
   * the current tick.
   *
   * @example
   * ```typescript
   * buffer.write(tickState);
   * // ... slots 2–8 read from buffer ...
   * buffer.flip(); // next tick ready
   * ```
   */
  flip(): void {
    this._writeIndex ^= 1;
    this._buffers[this._writeIndex] = null;
  }
}
