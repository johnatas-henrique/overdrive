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
 * - Event Bus integration: emits `gsm.state.exited` then `gsm.state.entered`
 *   on every successful transition (see TR-GSM-003)
 *
 * ## Design Decisions
 *
 * - **Event Bus is optional**: passed via constructor. If null/undefined,
 *   transitions complete without emissions and a one-time warning is logged.
 * - **`getCurrentState()` exists despite ADR-0024 Decision 6**: the ADR prohibits
 *   systems from *polling* state. This accessor is marked `@internal` and exists
 *   solely for test assertions and debug tooling. Game systems must subscribe
 *   to `gsm.state.entered`/`gsm.state.exited` via Event Bus.
 * - **`init()` is a separate lifecycle step** (not in constructor): deferred
 *   initialization allows Event Bus to be wired before GSM emits events.
 *
 * @see ADR-0024 — Game State Machine
 */

import type { IEventBus } from "../event-bus/types";
import { GameStateError } from "./GameStateError";
import type { State } from "./State";
import type { StateDefinition } from "./StateDefinition";
import { TRANSITIONS } from "./TransitionTable";

/** Event name for GSM state exit. */
const GSM_STATE_EXITED = "gsm.state.exited";
/** Event name for GSM state entry. */
const GSM_STATE_ENTERED = "gsm.state.entered";

export class GameStateMachine {
  private _currentState: State | undefined;
  private _stateDefinitions = new Map<State, StateDefinition>();
  private _busy = false;
  private readonly _eventBus: IEventBus | null | undefined;
  private _warnedEbMissing = false;

  /**
   * Create a new GameStateMachine.
   *
   * @param eventBus - Optional Event Bus instance for emitting state-change
   *   events. If null or undefined, transitions still complete but no events
   *   are emitted and a one-time warning is logged.
   *
   * @example
   * ```typescript
   * // With Event Bus
   * const gsm = new GameStateMachine(eventBus);
   *
   * // Without Event Bus (transitions work but no events emitted)
   * const gsm = new GameStateMachine();
   * ```
   */
  constructor(eventBus?: IEventBus | null) {
    this._eventBus = eventBus;
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
   * On successful transition, two Event Bus events are emitted in order:
   * `gsm.state.exited` (payload: `{ from: previousState }`) then
   * `gsm.state.entered` (payload: `{ from: previousState, to: newState }`).
   * Each emit is independently wrapped in try/catch — a failure in one does
   * not prevent the other, and the transition is never rolled back.
   *
   * Lifecycle hooks (if registered) are called in order:
   * `source.onExit()` → `target.onEnter()`. Both may be sync or async.
   * Async hooks are awaited before the transition is marked complete.
   *
   * If `onEnter()` rejects, the transition rolls back: the state remains
   * unchanged, a warning is logged, and `gsm.state.entered` is emitted
   * for the restored (previous) state via the Event Bus.
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

        // Emit Event Bus events (exited before entered, both resilient to failure)
        this._warnIfEbMissing();
        this._emitExited(previousState);
        this._emitEntered(previousState, target);
      } catch (error) {
        // Rollback: stay in previous state
        console.warn("[GSM] onEnter failed for", target, error);
        // Re-emit gsm.state.entered for previous state (restored)
        this._warnIfEbMissing();
        this._emitEntered(previousState, previousState);
      }
    } finally {
      this._busy = false;
    }
  }

  /**
   * Log a one-time warning if the Event Bus is not available.
   * Suppresses duplicate warnings across multiple transitions.
   */
  private _warnIfEbMissing(): void {
    if (!this._eventBus && !this._warnedEbMissing) {
      this._warnedEbMissing = true;
      console.warn("[GSM] Event Bus unavailable — events will not be emitted");
    }
  }

  /**
   * Emit `gsm.state.exited` for the given previous state.
   * Errors are caught and logged — they never abort the transition.
   */
  private _emitExited(from: State): void {
    try {
      this._eventBus?.emit(GSM_STATE_EXITED, { from });
    } catch (error) {
      console.warn("[GSM] Event Bus emit failed:", error);
    }
  }

  /**
   * Emit `gsm.state.entered` for the given transition.
   * Errors are caught and logged — they never abort the transition.
   */
  private _emitEntered(from: State, to: State): void {
    try {
      this._eventBus?.emit(GSM_STATE_ENTERED, { from, to });
    } catch (error) {
      console.warn("[GSM] Event Bus emit failed:", error);
    }
  }
}
