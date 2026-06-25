/**
 * Core Game State Machine — flat FSM with transition table.
 *
 * Manages the game's lifecycle phases: Loading, Menu, PreRace, Racing,
 * Paused, PostRace. Transitions are validated against a static table
 * and invalid transitions throw `GameStateError`.
 *
 * Features:
 * - O(1) transition lookup via `Record<State, State[]>` (array scan on ≤2 elements)
 * - Invalid transitions throw `GameStateError` (no silent ignores)
 * - Same-state transitions are silent no-ops
 * - `init()` is idempotent — safe to call multiple times
 *
 * ## Design Decisions (from code review)
 *
 * - **`getCurrentState()` exists despite ADR-0024 Decision 6** ("no public getCurrent"):
 *   The ADR prohibits systems from *polling* state. This accessor is marked `@internal`
 *   and exists solely for test assertions and debug tooling. Game systems must subscribe
 *   to `gsm.state.entered`/`gsm.state.exited` via Event Bus (implemented in Story 003).
 * - **`init()` is a separate lifecycle step** (not in constructor):
 *   Deferred initialization allows Event Bus to be wired before GSM emits events.
 *   The constructor creates the instance; `init()` activates it.
 * - **ADR Decisions 2–5 are deferred** to subsequent stories:
 *   D2 (onEnter/onExit) → Story 002, D3 (Event Bus) → Story 003,
 *   D4 (tick queue) → Story 004, D5 (ring buffer) → Story 005.
 *
 * @see ADR-0024 — Game State Machine
 */

import { GameStateError } from "./GameStateError";
import type { State } from "./State";
import { TRANSITIONS } from "./TransitionTable";

export class GameStateMachine {
  private _currentState: State | undefined;

  /**
   * Get the current state of the machine.
   *
   * **@internal** — Game systems must NOT poll this. They should
   * subscribe to `gsm.state.entered` / `gsm.state.exited` via the
   * Event Bus (ADR-0024 Decision 6). This accessor exists solely for
   * test assertions and debug tooling.
   *
   * @returns The current state, or `undefined` if `init()` has not been called
   *
   * @see ADR-0024 — Decision 6: No public `getCurrent()`
   */
  /** @internal */
  getCurrentState(): State | undefined {
    return this._currentState;
  }

  /**
   * Initialize the GSM, setting the initial state to `Loading`.
   *
   * Idempotent — calling a second time is a no-op.
   * Does NOT emit events — the initial state is a bootstrap, not a transition.
   *
   * @example
   * ```typescript
   * const gsm = new GameStateMachine();
   * gsm.init();
   * gsm.getCurrentState(); // 'Loading'
   * ```
   */
  init(): void {
    if (this._currentState !== undefined) {
      return; // Idempotent: already initialized
    }
    this._currentState = "Loading";
  }

  /**
   * Transition the GSM to a new state.
   *
   * - If `target` equals the current state, this is a silent no-op.
   * - If `target` is a valid transition from the current state, the state changes.
   * - If `target` is not in the transition table for the current state,
   *   a `GameStateError` is thrown and the state is unchanged.
   *
   * @param target - The state to transition to
   * @throws {GameStateError} If the transition is not defined in the table
   *
   * @example
   * ```typescript
   * gsm.init();         // Loading
   * gsm.transition("Menu"); // Loading → Menu (succeeds)
   * gsm.transition("Racing"); // Menu → Racing (throws GameStateError)
   * ```
   */
  transition(target: State): void {
    if (this._currentState === undefined) {
      throw new GameStateError("Uninitialized", target);
    }

    // Same-state transition: silent no-op
    if (target === this._currentState) {
      return;
    }

    const allowed = TRANSITIONS[this._currentState];
    if (!allowed || !allowed.includes(target)) {
      throw new GameStateError(this._currentState, target);
    }

    this._currentState = target;
  }
}
