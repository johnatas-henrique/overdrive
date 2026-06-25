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
 * - Optional lifecycle hooks (`onEnter`/`onExit`) per state definition
 * - Async hooks are awaited; `onEnter` rejection triggers rollback
 * - Internal `_busy` flag prevents concurrent transitions
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
import type { StateDefinition } from "./StateDefinition";
import { TRANSITIONS } from "./TransitionTable";

/**
 * Options for constructing a `GameStateMachine`.
 */
export interface GameStateMachineOptions {
  /**
   * Callback invoked when `gsm.state.entered` would be emitted.
   * Temporary mock for Story 003 (Event Bus integration).
   *
   * Called on rollback (when `onEnter` rejects) with the previous state.
   * Will be replaced by the real Event Bus in Story 003.
   *
   * @param state - The state that was entered (re-entered on rollback)
   */
  onStateEntered?: (state: State) => void;
}

export class GameStateMachine {
  private _currentState: State | undefined;
  private _stateDefinitions = new Map<State, StateDefinition>();
  private _busy = false;
  private readonly _onStateEntered?: (state: State) => void;

  /**
   * Create a new GameStateMachine.
   *
   * @param options - Optional configuration
   *
   * @example
   * ```typescript
   * const gsm = new GameStateMachine({
   *   onStateEntered: (state) => console.log("Entered:", state),
   * });
   * ```
   */
  constructor(options?: GameStateMachineOptions) {
    this._onStateEntered = options?.onStateEntered;
  }

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
   * Register state definitions with lifecycle hooks.
   *
   * Must be called before `transition()` to enable hooks. States without
   * definitions can still be transitioned to — hooks are optional.
   *
   * Hook values are validated at registration time: each must be `undefined`
   * or a function. Non-function values throw `TypeError`.
   *
   * @param defs - Array of state definitions
   * @throws {TypeError} If a hook is defined but is not a function
   *
   * @example
   * ```typescript
   * gsm.registerStates([
   *   { name: "Menu", onEnter: () => console.log("Entering Menu") },
   *   {
   *     name: "Racing",
   *     onEnter: () => loadRaceAssets(),
   *     onExit: () => cleanupRace(),
   *   },
   * ]);
   * ```
   */
  registerStates(defs: StateDefinition[]): void {
    for (const def of defs) {
      if (def.onEnter !== undefined && typeof def.onEnter !== "function") {
        throw new TypeError(
          `onEnter for state "${def.name}" must be a function, got ${typeof def.onEnter}`
        );
      }
      if (def.onExit !== undefined && typeof def.onExit !== "function") {
        throw new TypeError(
          `onExit for state "${def.name}" must be a function, got ${typeof def.onExit}`
        );
      }
      if (this._stateDefinitions.has(def.name)) {
        throw new TypeError(
          `Duplicate state definition for "${def.name}". Use registerStates() once per state.`
        );
      }
      this._stateDefinitions.set(def.name, def);
    }
  }

  /**
   * Transition the GSM to a new state.
   *
   * - If `target` equals the current state, this is a silent no-op.
   * - If `target` is a valid transition from the current state, the state changes.
   * - If `target` is not in the transition table for the current state,
   *   a `GameStateError` is thrown and the state is unchanged.
   * - If a transition is already in progress (`_busy`), a `GameStateError`
   *   is thrown. Story 004 will add queue management for this case.
   *
   * Lifecycle hooks (if registered) are called in order:
   * `source.onExit()` → `target.onEnter()`. Both may be sync or async.
   * Async hooks are awaited before the transition is marked complete.
   *
   * If `onEnter()` rejects, the transition rolls back: the state remains
   * unchanged, a warning is logged, and the `onStateEntered` callback
   * (if provided) is called with the previous state.
   *
   * @param target - The state to transition to
   * @returns A Promise that resolves when the transition completes
   * @throws {GameStateError} If the transition is not defined in the table,
   *   or if the GSM is busy with another transition
   *
   * @example
   * ```typescript
   * gsm.init();         // Loading
   * await gsm.transition("Menu"); // Loading → Menu (succeeds)
   * gsm.transition("Racing"); // Menu → Racing (throws GameStateError)
   * ```
   */
  async transition(target: State): Promise<void> {
    if (this._currentState === undefined) {
      throw new GameStateError("Uninitialized", target);
    }

    // Same-state transition: silent no-op
    if (target === this._currentState) {
      return;
    }

    // Prevent concurrent transitions (Story 004 will queue these)
    if (this._busy) {
      throw new GameStateError(this._currentState, target);
    }

    const allowed = TRANSITIONS[this._currentState];
    if (!allowed?.includes(target)) {
      throw new GameStateError(this._currentState, target);
    }

    const sourceDef = this._stateDefinitions.get(this._currentState);
    const targetDef = this._stateDefinitions.get(target);
    const previousState = this._currentState;

    this._busy = true;

    try {
      // Call source onExit — errors propagate to caller
      if (sourceDef?.onExit) {
        await sourceDef.onExit();
      }

      // Call target onEnter — errors trigger rollback
      try {
        if (targetDef?.onEnter) {
          await targetDef.onEnter();
        }

        // Transition complete — update state
        this._currentState = target;
      } catch (error) {
        // Rollback: stay in previous state
        console.warn("[GSM] onEnter failed for", target, error);
        // Re-emit gsm.state.entered for previous state (mock Event Bus)
        this._onStateEntered?.(previousState);
      }
    } finally {
      this._busy = false;
    }
  }
}
