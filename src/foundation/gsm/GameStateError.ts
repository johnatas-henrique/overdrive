/**
 * Custom error for invalid Game State Machine transitions.
 *
 * Thrown when a transition is attempted that is not defined in the
 * transition table. Carries `from` and `to` fields for debugging.
 *
 * @example
 * ```typescript
 * try {
 *   gsm.transition("Racing"); // while in Loading
 * } catch (e) {
 *   if (e instanceof GameStateError) {
 *     console.error(`Invalid transition: ${e.from} → ${e.to}`);
 *   }
 * }
 * ```
 *
 * @see ADR-0024 — Game State Machine, Decision 1
 */

import type { State } from "./State";

export class GameStateError extends Error {
  /** The state the machine was in when the invalid transition was attempted. */
  readonly from: State | "Uninitialized";

  /** The target state that was requested. */
  readonly to: State;

  /**
   * Create a new GameStateError.
   *
   * @param from - The current state the machine was in, or "Uninitialized" if init() was not called
   * @param to - The target state that was requested
   */
  constructor(from: State | "Uninitialized", to: State) {
    super(`Cannot transition from ${from} to ${to}`);
    this.name = "GameStateError";
    this.from = from;
    this.to = to;
  }
}
