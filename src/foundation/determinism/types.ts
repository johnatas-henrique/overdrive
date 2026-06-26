/**
 * Input state type definitions for the deterministic pipeline.
 *
 * Defines the `InputState` interface representing a complete snapshot of
 * player input for a single simulation tick, and the `InputState.ZERO`
 * constant for uninitialized / default states.
 *
 * @see ADR-0002 — Fixed Timestep & Determinism Pipeline, Input Buffering section
 * @see InputBuffer — Double-buffered consumer of InputState
 */

/**
 * Complete snapshot of player input for one simulation tick.
 *
 * All fields are required — partial input is not permitted. Numeric fields
 * use the documented range contracts:
 *
 * | Field       | Range                 | Notes                            |
 * | ----------- | --------------------- | -------------------------------- |
 * | `steer`     | -1 (full left) to +1  | Continuous analog-like value     |
 * | `throttle`  | 0 to 1                | 0 = no throttle, 1 = full        |
 * | `brake`     | 0 to 1                | 0 = no brake, 1 = full           |
 * | `gearDelta` | -1, 0, or +1          | Upshift (+1), downshift (-1), or no change (0) |
 *
 * Boolean fields represent discrete button/action state:
 * - `confirm`, `cancel`, `navUp`, `navDown` — menu/UI navigation
 * - `pauseToggle`, `cameraToggle` — toggle actions (edge-triggered)
 *
 * @example
 * ```typescript
 * const state: InputState = {
 *   steer: 0.5,
 *   throttle: 1,
 *   brake: 0,
 *   gearDelta: 0,
 *   confirm: false,
 *   pauseToggle: false,
 *   cameraToggle: false,
 *   cancel: false,
 *   navUp: false,
 *   navDown: false,
 * };
 * ```
 */
export interface InputState {
  /** Steering input: -1 (full left) to +1 (full right). */
  readonly steer: number;
  /** Throttle input: 0 (none) to 1 (full). */
  readonly throttle: number;
  /** Brake input: 0 (none) to 1 (full). */
  readonly brake: number;
  /** Gear change delta: -1 (downshift), 0 (no change), +1 (upshift). */
  readonly gearDelta: -1 | 0 | 1;
  /** Confirm / accept action (button). */
  readonly confirm: boolean;
  /** Pause toggle action (edge-triggered). */
  readonly pauseToggle: boolean;
  /** Camera toggle action (edge-triggered). */
  readonly cameraToggle: boolean;
  /** Cancel / back action (button). */
  readonly cancel: boolean;
  /** Navigate up (menu/UI). */
  readonly navUp: boolean;
  /** Navigate down (menu/UI). */
  readonly navDown: boolean;
}

/**
 * Namespace merging provides `InputState.ZERO` as a static-like constant
 * on the `InputState` type.
 *
 * TypeScript interfaces and namespaces with the same name merge:
 * - `InputState` (interface) — the type
 * - `InputState.ZERO` (namespace constant) — the default value
 */
export namespace InputState {
  /**
   * Default input state with all fields at zero / false.
   *
   * Used as the return value from `InputBuffer.read()` when no `write()`
   * has occurred in the current tick. Prevents stale input from leaking
   * into the first frame or after a `flip()` without a preceding `write()`.
   *
   * @example
   * ```typescript
   * const defaultState = InputState.ZERO;
   * console.log(defaultState.steer); // 0
   * console.log(defaultState.confirm); // false
   * ```
   */
  export const ZERO: InputState = {
    steer: 0,
    throttle: 0,
    brake: 0,
    gearDelta: 0,
    confirm: false,
    pauseToggle: false,
    cameraToggle: false,
    cancel: false,
    navUp: false,
    navDown: false,
  } as const;
}
