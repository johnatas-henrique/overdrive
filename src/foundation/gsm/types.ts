/**
 * Game State Machine types.
 *
 * @see ADR-0024 — Game State Machine
 */

/** @see ADR-0024 — Game State Machine, Decision 1 */
export type State =
  | "Loading"
  | "Menu"
  | "PreRace"
  | "Racing"
  | "Paused"
  | "PostRace";

/**
 * State definition with optional lifecycle hooks for the Game State Machine.
 *
 * Each state in the GSM can define `onEnter` and `onExit` hooks that are
 * called during transitions. Hooks may be synchronous or asynchronous.
 *
 * @see ADR-0024 — Game State Machine, Decision 2
 * @see TR-GSM-002 — Per-state onEnter/onExit hooks
 */
export interface StateDefinition {
  /** The state this definition represents. */
  name: State;

  /**
   * Called when entering this state. May return `void` or `Promise<void>`.
   * If the returned Promise rejects, the transition rolls back to the
   * previous state and a warning is logged.
   */
  onEnter?: () => void | Promise<void>;

  /**
   * Called when exiting this state. May return `void` or `Promise<void>`.
   * If this throws or rejects, the error propagates to the caller.
   *
   * **Important**: If the target's `onEnter` rejects, `onExit` will have
   * already been called. Ensure `onExit` side effects are safe to leave
   * in place or idempotent.
   */
  onExit?: () => void | Promise<void>;
}
